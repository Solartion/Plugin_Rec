var originalDialogMode = app.displayDialogs;

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

function _saveJpegFast(file, q) {
    var idsave = charIDToTypeID("save");
    var desc3 = new ActionDescriptor();
    var idAs = charIDToTypeID("As  ");
    var desc4 = new ActionDescriptor();
    desc4.putInteger(charIDToTypeID("EQlt"), q);
    desc4.putEnumerated(stringIDToTypeID("matteColor"), stringIDToTypeID("matteColor"), charIDToTypeID("None"));
    desc3.putObject(idAs, charIDToTypeID("JPEG"), desc4);
    desc3.putPath(charIDToTypeID("In  "), file);
    desc3.putBoolean(charIDToTypeID("LwCs"), true);
    desc3.putBoolean(charIDToTypeID("docI"), true);
    desc3.putBoolean(charIDToTypeID("Cpy "), true);
    executeAction(idsave, desc3, DialogModes.NO);
}

function _saveJpegFallback(doc, file, q) {
    var jpegOpts = new JPEGSaveOptions();
    jpegOpts.quality = q;
    jpegOpts.embedColorProfile = false;
    jpegOpts.formatOptions = FormatOptions.STANDARDBASELINE;
    doc.saveAs(file, jpegOpts, true, Extension.LOWERCASE);
}

function captureFrame(outputFolder, frameNumber, quality, scaleFactor, force, recordingDocName) {
    try {
        if (!app.documents.length) {
            return '{"error":"NO_DOCUMENT","message":"No open document"}';
        }

        var doc = app.activeDocument;

        if (recordingDocName && doc.name !== recordingDocName) {
            return '{"error":"WRONG_DOCUMENT"}';
        }

        var savedDialogs = app.displayDialogs;
        app.displayDialogs = DialogModes.NO;

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

        var q = (quality && quality > 0) ? quality : 5;
        if (q > 12) { q = Math.round(q * 12 / 100); }

        try {
            _saveJpegFast(file, q);
        } catch (se) {
            try {
                _saveJpegFallback(doc, file, q);
            } catch (saveErr) {
                app.displayDialogs = savedDialogs;
                return '{"error":"SAVE_ERROR","message":"' + escStr(saveErr.message) + '"}';
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

function checkFolder(folderPath) {
    try {
        var folder = new Folder(folderPath);
        var exists = folder.exists ? "true" : "false";
        return '{"exists":' + exists + ',"path":"' + escStr(folder.fsName) + '"}';
    } catch (e) {
        return '{"error":"CHECK_ERROR","message":"' + escStr(e.message) + '"}';
    }
}

function selectFFmpeg() {
    // Existing code unchanged
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
