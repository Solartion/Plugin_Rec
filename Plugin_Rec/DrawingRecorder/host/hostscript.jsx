/**
 * Drawing Recorder - ExtendScript Host
 * Handles canvas snapshots for Photoshop 2019-2022
 * NOTE: No JSON.stringify - ExtendScript is ES3
 */

// Suppress all dialogs during automated operations
var originalDialogMode = app.displayDialogs;

/**
 * Escape a string for safe JSON embedding.
 */
function escStr(s) {
    if (s === undefined || s === null) return "";
    s = String(s);
    s = s.replace(/\\/g, "\\\\");
    s = s.replace(/"/g, '\\"');
    s = s.replace(/\n/g, "\\n");
    s = s.replace(/\r/g, "\\r");
    s = s.replace(/\t/g, "\\t");
    return s;
}

/**
 * Get information about the active document.
 */
function getDocumentInfo() {
    try {
        if (!app.documents.length) {
            return '{"error":"NO_DOCUMENT","message":"No open document"}';
        }
        var doc = app.activeDocument;
        var w = doc.width.as("px");
        var h = doc.height.as("px");
        var res = doc.resolution;
        var layers = doc.layers.length;
        var docName = escStr(doc.name);
        var docPath = "";
        try { docPath = escStr(doc.path.fsName); } catch (pe) { docPath = ""; }

        return '{"name":"' + docName +
            '","width":' + w +
            ',"height":' + h +
            ',"resolution":' + res +
            ',"layers":' + layers +
            ',"path":"' + docPath + '"}';
    } catch (e) {
        return '{"error":"ERROR","message":"' + escStr(e.message) + '"}';
    }
}

/**
 * Create output folder for the recording session.
 */
function createOutputFolder(basePath, sessionName) {
    try {
        var baseFolder = new Folder(basePath);
        if (!baseFolder.exists) {
            baseFolder.create();
        }
        var sessionFolder = new Folder(basePath + "/" + sessionName);
        if (!sessionFolder.exists) {
            sessionFolder.create();
        }
        return '{"path":"' + escStr(sessionFolder.fsName) + '"}';
    } catch (e) {
        return '{"error":"FOLDER_ERROR","message":"' + escStr(e.message) + '"}';
    }
}

/**
 * Select a folder using OS native dialog.
 */
function selectFolder() {
    try {
        var folder = Folder.selectDialog("Select folder for recording frames");
        if (folder !== null && folder !== undefined) {
            return '{"path":"' + escStr(folder.fsName) + '"}';
        } else {
            return '{"cancelled":true}';
        }
    } catch (e) {
        return '{"error":"FOLDER_ERROR","message":"' + escStr(e.message) + '"}';
    }
}

var _lastHistoryId = null;

/**
 * Capture the current canvas state as a JPEG frame.
 * OPTIMIZED: Uses ActionDescriptor to instantly save a flattened JPEG copy
 * without actually modifying the document tree, making it virtually freeze-free.
 * Reverts to skip if the user's history state has not changed (i.e. idle).
 */
function captureFrame(outputFolder, frameNumber, quality, forceScaleIgnored, force) {
    try {
        if (!app.documents.length) {
            return '{"error":"NO_DOCUMENT","message":"No open document"}';
        }

        var doc = app.activeDocument;
        var savedDialogs = app.displayDialogs;
        app.displayDialogs = DialogModes.NO;

        // Check history state to avoid saving if no changes
        try {
            var histId = doc.activeHistoryState.name + "_" + doc.historyStates.length;
            if (!force && _lastHistoryId === histId) {
                app.displayDialogs = savedDialogs;
                return '{"error":"NO_CHANGE"}';
            }
            _lastHistoryId = histId;
        } catch (he) { }

        var padded = ("00000" + frameNumber).slice(-5);
        var fileName = "frame_" + padded + ".jpg";
        var file = new File(outputFolder + "/" + fileName);

        // Quality 1-12
        var q = (quality && quality > 0) ? quality : 5;
        if (q > 12) { q = Math.round(q * 12 / 100); }

        try {
            // Very fast direct ActionDescriptor JPEG Save As Copy
            var idsave = charIDToTypeID("save");
            var desc3 = new ActionDescriptor();
            var idAs = charIDToTypeID("As  ");
            var desc4 = new ActionDescriptor();
            var idEQlt = charIDToTypeID("EQlt");
            desc4.putInteger(idEQlt, q);
            var idMatteColor = stringIDToTypeID("matteColor");
            var idMatteColorEnum = stringIDToTypeID("matteColor");
            var idNone = charIDToTypeID("None");
            desc4.putEnumerated(idMatteColor, idMatteColorEnum, idNone);
            var idJPEG = charIDToTypeID("JPEG");
            desc3.putObject(idAs, idJPEG, desc4);
            var idIn = charIDToTypeID("In  ");
            desc3.putPath(idIn, file);
            var idLwCs = charIDToTypeID("LwCs");
            desc3.putBoolean(idLwCs, true);
            var iddocI = charIDToTypeID("docI");
            desc3.putBoolean(iddocI, true); // As Copy
            var idCpy = charIDToTypeID("Cpy ");
            desc3.putBoolean(idCpy, true); // Save as copy
            executeAction(idsave, desc3, DialogModes.NO);
        } catch (se) {
            // Fallback for any compatibility reason
            var jpegOpts = new JPEGSaveOptions();
            jpegOpts.quality = q;
            jpegOpts.embedColorProfile = false;
            jpegOpts.formatOptions = FormatOptions.STANDARDBASELINE;
            try {
                doc.saveAs(file, jpegOpts, true, Extension.LOWERCASE);
            } catch (saveErr) {
                app.displayDialogs = savedDialogs;
                return '{"error":"SAVE_ERROR", "message":"' + escStr(saveErr.message) + '"}';
            }
        }

        app.displayDialogs = savedDialogs;

        return '{"success":true,"frame":' + frameNumber +
            ',"path":"' + escStr(file.fsName) +
            '","fileName":"' + escStr(fileName) + '"}';
    } catch (e) {
        try { app.displayDialogs = originalDialogMode; } catch (x) { }
        return '{"error":"CAPTURE_ERROR","message":"' + escStr(e.message) + '","frame":' + frameNumber + '}';
    }
}

/**
 * Check if a folder exists.
 */
function checkFolder(folderPath) {
    try {
        var folder = new Folder(folderPath);
        var exists = folder.exists ? "true" : "false";
        return '{"exists":' + exists + ',"path":"' + escStr(folder.fsName) + '"}';
    } catch (e) {
        return '{"error":"CHECK_ERROR","message":"' + escStr(e.message) + '"}';
    }
}

/**
 * Select FFmpeg executable via OS file dialog.
 */
function selectFFmpeg() {
    try {
        var f = File.openDialog("Select ffmpeg executable", "ffmpeg*");
        if (f !== null && f !== undefined) {
            return '{"path":"' + escStr(f.fsName) + '"}';
        } else {
            return '{"cancelled":true}';
        }
    } catch (e) {
        return '{"error":"SELECT_ERROR","message":"' + escStr(e.message) + '"}';
    }
}

