/**
 * Drawing Recorder — Main Panel Logic v2.0
 * Records drawing process and encodes to video via FFmpeg
 * Supports: MP4, MKV, MOV, AVI, WebM
 */

(function () {
    "use strict";

    // ============ CEP & Node.js Setup ============
    var csInterface = new CSInterface();
    var path, fs, childProcess, nodeTimers;
    try {
        path = require("path");
        fs = require("fs");
        childProcess = require("child_process");
        nodeTimers = require("timers");
    } catch (e) {
        // Will be handled in init
    }

    // ============ State ============
    var state = {
        recording: false,
        paused: false,
        encoding: false,
        frameCount: 0,
        intervalMs: 3000,
        outputFolder: "",
        ffmpegPath: "",
        videoFormat: "mp4",
        frameHold: 0.5,
        resScale: 2,
        deleteFrames: true,
        sessionName: "",
        sessionFolder: "",
        timer: null,
        startTime: null,
        pausedTime: 0,
        pauseStart: null,
        elapsedTimer: null,
        captureTimer: null,
        captureBusy: false,
        captureLastTime: 0,
        cropTop: 0,
        cropLeft: 0,
        cropRight: 0,
        cropBottom: 0,
        smoothTransitions: true,
        recordingDocName: "",
        mouseDown: false,
        mouseWatcher: null
    };

    // ============ FFmpeg codec configs ============
    var CODECS = {
        mp4: { ext: "mp4", vcodec: "libx264", pix: "yuv420p", extra: ["-preset", "medium", "-crf", "23"] },
        mkv: { ext: "mkv", vcodec: "libx264", pix: "yuv420p", extra: ["-preset", "medium", "-crf", "23"] },
        mov: { ext: "mov", vcodec: "libx264", pix: "yuv420p", extra: ["-preset", "medium", "-crf", "23"] },
        avi: { ext: "avi", vcodec: "mjpeg", pix: "yuvj420p", extra: ["-q:v", "3"] },
        webm: { ext: "webm", vcodec: "libvpx-vp9", pix: "yuv420p", extra: ["-b:v", "2M", "-crf", "30"] }
    };

    // ============ DOM Elements ============
    var el = {
        statusBadge: document.getElementById("statusBadge"),
        statusText: document.getElementById("statusText"),
        docInfo: document.getElementById("docInfo"),
        docName: document.getElementById("docName"),
        docSize: document.getElementById("docSize"),
        btnRecord: document.getElementById("btnRecord"),
        btnPause: document.getElementById("btnPause"),
        btnStop: document.getElementById("btnStop"),
        frameCount: document.getElementById("frameCount"),
        elapsedTime: document.getElementById("elapsedTime"),
        totalSize: document.getElementById("totalSize"),
        progressBar: document.getElementById("progressBar"),
        progressFill: document.getElementById("progressFill"),
        intervalSlider: document.getElementById("intervalSlider"),
        intervalValue: document.getElementById("intervalValue"),
        videoFormat: document.getElementById("videoFormat"),
        frameHold: document.getElementById("frameHold"),
        resScale: document.getElementById("resScale"),
        folderPath: document.getElementById("folderPath"),
        btnSelectFolder: document.getElementById("btnSelectFolder"),
        ffmpegPath: document.getElementById("ffmpegPath"),
        btnSelectFFmpeg: document.getElementById("btnSelectFFmpeg"),
        chkDeleteFrames: document.getElementById("chkDeleteFrames"),
        logContainer: document.getElementById("logContainer"),
        encodingSection: document.getElementById("encodingSection"),
        encodingStatus: document.getElementById("encodingStatus"),
        encodingFill: document.getElementById("encodingFill"),

        // Minimal UI
        mainUI: document.getElementById("mainUI"),
        minimalUI: document.getElementById("minimalUI"),
        minDot: document.getElementById("minDot"),
        minTime: document.getElementById("minTime"),
        btnMinPause: document.getElementById("btnMinPause"),
        btnMinStop: document.getElementById("btnMinStop"),
        cropTop: document.getElementById("cropTop"),
        cropLeft: document.getElementById("cropLeft"),
        cropRight: document.getElementById("cropRight"),
        cropBottom: document.getElementById("cropBottom"),
        chkSmoothTransitions: document.getElementById("chkSmoothTransitions")
    };

    // ============ Initialization ============
    function init() {
        loadSettings();
        bindEvents();
        refreshDocInfo();

        csInterface.addEventListener("documentAfterActivate", refreshDocInfo);
        csInterface.addEventListener("documentAfterDeactivate", refreshDocInfo);

        // Detect FFmpeg lazily to avoid freezing Photoshop on startup
        if (childProcess) {
            setTimeout(detectFFmpeg, 2000);
        }

        window.addEventListener("beforeunload", function () {
            var clrInt = nodeTimers ? nodeTimers.clearInterval : clearInterval;
            if (state.captureTimer) clrInt(state.captureTimer);
            stopMouseWatcher();
        });

        log("info", "Drawing Recorder v2.0 loaded.");
    }

    function bindEvents() {
        el.btnRecord.addEventListener("click", onRecordClick);
        el.btnPause.addEventListener("click", onPauseClick);
        el.btnStop.addEventListener("click", onStopClick);
        el.btnSelectFolder.addEventListener("click", onSelectFolder);
        el.btnSelectFFmpeg.addEventListener("click", onSelectFFmpeg);
        el.intervalSlider.addEventListener("input", onIntervalChange);
        el.videoFormat.addEventListener("change", onFormatChange);
        el.frameHold.addEventListener("change", onFrameHoldChange);
        el.resScale.addEventListener("change", onResScaleChange);
        el.chkDeleteFrames.addEventListener("change", onDeleteFramesChange);
        el.chkSmoothTransitions.addEventListener("change", onSmoothTransitionsChange);

        el.btnMinPause.addEventListener("click", onPauseClick);
        el.btnMinStop.addEventListener("click", onStopClick);
    }

    // ============ FFmpeg Detection ============
    function detectFFmpeg() {
        // If saved path exists on disk, trust it without spawning a process
        if (state.ffmpegPath && fs.existsSync(state.ffmpegPath)) {
            setFFmpegUI(state.ffmpegPath);
            return;
        }

        // Build list of paths to check
        var candidates = [];

        // 1. Relative to this JS file's directory (client/) -> ../tools/
        try {
            var dirName = __dirname || "";
            if (dirName) {
                candidates.push(path.resolve(dirName, "..", "tools", "ffmpeg.exe"));
            }
        } catch (e) { }

        // 2. Via CSInterface extension path
        try {
            var extPath = csInterface.getSystemPath("extension");
            if (extPath) {
                // CEP may return path with leading / on Windows like /c/Users/...
                var normalized = extPath.replace(/^\/([a-zA-Z])\//, "$1:/").replace(/\//g, "\\");
                candidates.push(path.join(normalized, "tools", "ffmpeg.exe"));
                candidates.push(path.join(extPath, "tools", "ffmpeg.exe"));
            }
        } catch (e) { }

        // 3. Try each candidate
        for (var i = 0; i < candidates.length; i++) {
            var c = candidates[i];
            try {
                if (fs.existsSync(c) && isFFmpegValid(c)) {
                    state.ffmpegPath = c;
                    setFFmpegUI(c);
                    saveSettings();
                    log("success", "FFmpeg found: " + c);
                    return;
                }
            } catch (e) { }
        }

        // 4. Try system PATH
        var cmd = process.platform === "win32" ? "where ffmpeg" : "which ffmpeg";
        try {
            var result = childProcess.execSync(cmd, { encoding: "utf8", timeout: 5000 });
            var found = result.trim().split("\n")[0].trim();
            if (found && isFFmpegValid(found)) {
                state.ffmpegPath = found;
                setFFmpegUI(found);
                saveSettings();
                log("success", "FFmpeg found (PATH): " + found);
                return;
            }
        } catch (e) { }

        log("warning", "FFmpeg not found. Run install.bat or specify path manually.");
    }

    function isFFmpegValid(ffPath) {
        try {
            childProcess.execSync('"' + ffPath + '" -version', {
                encoding: "utf8",
                timeout: 5000,
                windowsHide: true
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    function setFFmpegUI(ffPath) {
        el.ffmpegPath.textContent = shortenPath(ffPath);
        el.ffmpegPath.title = ffPath;
        el.ffmpegPath.classList.add("has-path");
    }

    function onSelectFFmpeg() {
        evalScript("selectFFmpeg()", function (result) {
            if (!result || result === "undefined") return;
            try {
                var res = JSON.parse(result);
                if (res.cancelled) return;
                if (res.error) {
                    log("error", "Error: " + res.message);
                    return;
                }
                var ffPath = res.path;
                log("info", "Validating FFmpeg: " + ffPath);
                if (isFFmpegValid(ffPath)) {
                    state.ffmpegPath = ffPath;
                    setFFmpegUI(ffPath);
                    saveSettings();
                    log("success", "FFmpeg set: " + ffPath);
                } else {
                    log("error", "Invalid FFmpeg: " + ffPath);
                    log("error", "Check antivirus or try running ffmpeg.exe manually.");
                }
            } catch (e) {
                log("error", "Error selecting FFmpeg: " + e.message);
            }
        });
    }

    // ============ Settings Persistence ============
    function loadSettings() {
        try {
            var saved = localStorage.getItem("drawingRecorderSettings_v2");
            if (saved) {
                var s = JSON.parse(saved);
                if (s.interval) {
                    state.intervalMs = s.interval * 1000;
                    el.intervalSlider.value = s.interval;
                    el.intervalValue.textContent = s.interval;
                }
                if (s.folder) {
                    state.outputFolder = s.folder;
                    el.folderPath.textContent = shortenPath(s.folder);
                    el.folderPath.title = s.folder;
                    el.folderPath.classList.add("has-path");
                }
                if (s.ffmpeg) {
                    state.ffmpegPath = s.ffmpeg;
                }
                if (s.format) {
                    state.videoFormat = s.format;
                    el.videoFormat.value = s.format;
                }
                if (s.frameHold) {
                    state.frameHold = s.frameHold;
                    el.frameHold.value = s.frameHold;
                }
                if (s.resScale) {
                    state.resScale = s.resScale;
                    el.resScale.value = s.resScale;
                }
                if (s.deleteFrames !== undefined) {
                    state.deleteFrames = s.deleteFrames;
                    el.chkDeleteFrames.checked = s.deleteFrames;
                }
                if (s.cropTop !== undefined) {
                    state.cropTop = s.cropTop;
                    el.cropTop.value = s.cropTop;
                }
                if (s.cropLeft !== undefined) {
                    state.cropLeft = s.cropLeft;
                    el.cropLeft.value = s.cropLeft;
                }
                if (s.cropRight !== undefined) {
                    state.cropRight = s.cropRight;
                    el.cropRight.value = s.cropRight;
                }
                if (s.cropBottom !== undefined) {
                    state.cropBottom = s.cropBottom;
                    el.cropBottom.value = s.cropBottom;
                }
                if (s.smoothTransitions !== undefined) {
                    state.smoothTransitions = s.smoothTransitions;
                    el.chkSmoothTransitions.checked = s.smoothTransitions;
                }
            }
        } catch (e) { }
    }

    function saveSettings() {
        try {
            localStorage.setItem("drawingRecorderSettings_v2", JSON.stringify({
                interval: state.intervalMs / 1000,
                folder: state.outputFolder,
                ffmpeg: state.ffmpegPath,
                format: state.videoFormat,
                frameHold: state.frameHold,
                resScale: state.resScale,
                deleteFrames: state.deleteFrames,
                cropTop: state.cropTop,
                cropLeft: state.cropLeft,
                cropRight: state.cropRight,
                cropBottom: state.cropBottom,
                smoothTransitions: state.smoothTransitions
            }));
        } catch (e) { }
    }

    // ============ Document Info ============
    function refreshDocInfo() {
        evalScript("getDocumentInfo()", function (result) {
            if (!result || result === "undefined" || result === "null") {
                showDocPlaceholder();
                return;
            }
            try {
                var info = JSON.parse(result);
                if (info.error) { showDocPlaceholder(); return; }
                el.docInfo.querySelector(".doc-info-placeholder").style.display = "none";
                el.docInfo.querySelector(".doc-info-content").style.display = "flex";
                el.docName.textContent = info.name;
                el.docSize.textContent = info.width + " \u00d7 " + info.height + " px | " + info.layers + " layers";
            } catch (e) {
                showDocPlaceholder();
            }
        });
    }

    function showDocPlaceholder() {
        el.docInfo.querySelector(".doc-info-placeholder").style.display = "flex";
        el.docInfo.querySelector(".doc-info-content").style.display = "none";
    }

    // ============ Recording Control ============
    function onRecordClick() {
        if (state.recording || state.encoding) return;

        if (!state.ffmpegPath) {
            log("warning", "Specify FFmpeg path first");
            onSelectFFmpeg();
            return;
        }

        if (!state.outputFolder) {
            log("warning", "Select output folder first");
            onSelectFolder();
            return;
        }

        evalScript("getDocumentInfo()", function (result) {
            if (!result || result === "undefined") {
                log("error", "ExtendScript not responding. Restart PS.");
                return;
            }
            try {
                var info = JSON.parse(result);
                if (info.error) {
                    log("error", "Open a document before recording");
                    return;
                }
                startRecording(info);
            } catch (e) {
                log("error", "Doc check error: " + e.message + " | Raw: " + result);
            }
        });
    }

    function startRecording(docInfo) {
        var now = new Date();
        state.sessionName = "rec_" +
            now.getFullYear() +
            pad2(now.getMonth() + 1) +
            pad2(now.getDate()) + "_" +
            pad2(now.getHours()) +
            pad2(now.getMinutes()) +
            pad2(now.getSeconds());

        var escapedBase = escapeForScript(state.outputFolder);
        var escapedSession = escapeForScript(state.sessionName);

        evalScript('createOutputFolder("' + escapedBase + '", "' + escapedSession + '")', function (result) {
            if (!result || result === "undefined") {
                log("error", "Failed to create folder: no response");
                return;
            }
            try {
                var res = JSON.parse(result);
                if (res.error) {
                    log("error", "Failed to create folder: " + res.message);
                    return;
                }

                state.recording = true;
                state.paused = false;
                state.frameCount = 0;
                state.startTime = Date.now();
                state.pausedTime = 0;
                state.sessionFolder = res.path;
                state.recordingDocName = docInfo.name;

                updateUI("recording");
                log("success", "Recording started: " + state.sessionName);
                log("info", "Interval: " + (state.intervalMs / 1000) + "s | Format: " + state.videoFormat.toUpperCase() + " | Doc: " + docInfo.name + (state.smoothTransitions ? " | Smooth ON" : ""));

                // Start mouse watcher for drawing detection
                startMouseWatcher();

                // Start capture interval (setInterval — immune to hung evalScript)
                state.captureBusy = false;
                state.captureLastTime = Date.now();
                var setInt2 = nodeTimers ? nodeTimers.setInterval : setInterval;
                state.captureTimer = setInt2(captureLoop, state.intervalMs);

                // Capture first frame immediately
                captureLoop();

                var setInt = nodeTimers ? nodeTimers.setInterval : setInterval;
                state.elapsedTimer = setInt(updateElapsedTime, 1000);
            } catch (e) {
                log("error", "Start error: " + e.message + " | Raw: " + result);
            }
        });
    }

    function onPauseClick() {
        if (!state.recording) return;
        if (state.paused) {
            state.paused = false;
            state.pausedTime += (Date.now() - state.pauseStart);
            state.pauseStart = null;
            updateUI("recording");
            log("info", "Recording resumed");
        } else {
            state.paused = true;
            state.pauseStart = Date.now();
            updateUI("paused");
            log("warning", "Recording paused");
        }
    }

    function onStopClick() {
        if (!state.recording) return;

        state.recording = false;
        state.paused = false;
        state.captureBusy = false;
        state.recordingDocName = "";
        stopMouseWatcher();

        var clrInt = nodeTimers ? nodeTimers.clearInterval : clearInterval;
        clrInt(state.elapsedTimer);
        state.elapsedTimer = null;
        clrInt(state.captureTimer);
        state.captureTimer = null;

        updateUI("idle");
        log("success", "Recording stopped. Frames: " + state.frameCount);

        if (state.frameCount > 0) {
            encodeVideo();
        } else {
            log("warning", "No frames to encode");
        }
    }

    // ============ Mouse Watcher (defers capture while user is drawing) ============
    function startMouseWatcher() {
        if (!childProcess) return;
        try {
            var scriptPath = path.resolve(__dirname || ".", "..", "tools", "mouse_watcher.ps1");
            if (!fs.existsSync(scriptPath)) {
                log("warning", "mouse_watcher.ps1 not found, drawing detection disabled");
                return;
            }
            state.mouseWatcher = childProcess.spawn("powershell.exe", [
                "-ExecutionPolicy", "Bypass",
                "-NoProfile",
                "-File", scriptPath
            ], { windowsHide: true });

            state.mouseWatcher.stdout.on("data", function (data) {
                var line = data.toString().trim();
                // Only care about the last state in a batch
                var lines = line.split("\n");
                var last = lines[lines.length - 1].trim();
                state.mouseDown = (last === "DOWN");
            });

            state.mouseWatcher.on("error", function () {
                state.mouseDown = false;
                state.mouseWatcher = null;
            });

            state.mouseWatcher.on("close", function () {
                state.mouseDown = false;
                state.mouseWatcher = null;
            });
        } catch (e) {
            log("warning", "Mouse watcher failed: " + e.message);
        }
    }

    function stopMouseWatcher() {
        if (state.mouseWatcher) {
            try { state.mouseWatcher.kill(); } catch (e) { }
            state.mouseWatcher = null;
            state.mouseDown = false;
        }
    }

    // ============ JSX Capture Loop (setInterval-based, immune to hung callbacks) ============
    function captureLoop() {
        if (!state.recording || state.paused) return;

        // Defer capture while user is actively drawing (mouse button down)
        if (state.mouseDown) return;

        // If the previous evalScript call hasn't returned yet, skip
        // But if it's been stuck for >30s, force-reset (safety valve)
        if (state.captureBusy) {
            if (Date.now() - state.captureLastTime > 30000) {
                log("warning", "Capture hung >30s, resetting...");
                state.captureBusy = false;
            } else {
                return;
            }
        }

        state.captureBusy = true;
        state.captureLastTime = Date.now();

        var folder = escapeForScript(state.sessionFolder);
        var q = 4;
        var sf = state.resScale || 1;
        var isFirst = state.frameCount === 0 ? "true" : "false";
        var docName = escapeForScript(state.recordingDocName);

        var script = 'captureFrame("' + folder + '", ' + (state.frameCount + 1) + ', ' + q + ', ' + sf + ', ' + isFirst + ', "' + docName + '")';

        evalScript(script, function (result) {
            // Add a small cooldown after capture to let PS breathe (reduces micro-freezes)
            var setTO = nodeTimers ? nodeTimers.setTimeout : setTimeout;
            setTO(function () { state.captureBusy = false; }, 500);
            if (!state.recording) return;

            try {
                if (result && result !== "undefined" && result !== "EvalScript error") {
                    var res = JSON.parse(result);
                    if (res.error) {
                        if (res.error !== "NO_CHANGE" && res.error !== "WRONG_DOCUMENT") {
                            log("warning", "Capture error: " + res.message);
                        }
                    } else if (res.success) {
                        state.frameCount = res.frame;
                        el.frameCount.textContent = state.frameCount;
                        animateProgress();
                        log("capture", "Frame #" + res.frame + ": " + res.fileName);
                    }
                } else if (result === "EvalScript error") {
                    log("warning", "EvalScript error - PS busy, will retry");
                }
            } catch (e) {
                log("error", "Parse err: " + e.message + " | Raw: " + String(result).substring(0, 50));
            }
        });
    }


    // ============ Video Encoding ============
    function encodeVideo() {
        state.encoding = true;
        var codec = CODECS[state.videoFormat];

        // Normalize paths to forward slashes — FFmpeg on Windows handles
        // forward slashes fine, but can choke on backslashes in patterns
        var sessionNorm = state.sessionFolder.replace(/\\/g, "/");
        var outputNorm = state.outputFolder.replace(/\\/g, "/");
        var inputPattern = sessionNorm + "/frame_%05d.jpg";
        var outputFile = outputNorm + "/" + state.sessionName + "." + codec.ext;

        // Verify frames exist before attempting to encode
        try {
            var files = fs.readdirSync(state.sessionFolder);
            var jpgCount = 0;
            for (var fi = 0; fi < files.length; fi++) {
                if (files[fi].match(/^frame_\d{5}\.jpg$/)) jpgCount++;
            }
            log("info", "Found " + jpgCount + " frame files in " + sessionNorm);
            if (jpgCount === 0) {
                log("error", "No frame files found! Encoding aborted.");
                state.encoding = false;
                return;
            }
        } catch (dirErr) {
            log("error", "Cannot read session folder: " + dirErr.message);
            state.encoding = false;
            return;
        }

        log("info", "Encoding " + state.frameCount + " frames to " + codec.ext.toUpperCase() + "...");

        el.encodingSection.style.display = "block";
        el.encodingSection.classList.remove("encoding-done");
        el.encodingStatus.textContent = "Encoding video...";
        el.encodingFill.style.width = "0%";

        // Disable controls during encoding
        el.btnRecord.disabled = true;

        var inputFps = String(Math.round(1 / state.frameHold * 100) / 100);
        var args = [
            "-y",
            "-start_number", "1",
            "-framerate", inputFps,
            "-i", inputPattern,
            "-c:v", codec.vcodec,
            "-r", "30",
            "-pix_fmt", codec.pix
        ];

        var sf = state.resScale || 1;
        var vfFilters = [];
        if (sf > 1) {
            // Downscale during encoding (frames saved at full res for speed)
            vfFilters.push("scale=iw/" + sf + ":ih/" + sf);
        }

        // Ensure even dimensions (required for yuv420p)
        vfFilters.push("crop=trunc(iw/2)*2:trunc(ih/2)*2");

        if (state.smoothTransitions) {
            // framerate filter with full blending: interp_start=0 (blend from beginning),
            // interp_end=255 (blend until end), scene=100 (disable scene change detection
            // so EVERY frame transition gets blended). This produces a visible crossfade.
            vfFilters.push("framerate=fps=30:interp_start=0:interp_end=255:scene=100");
        }

        args.push("-vf", vfFilters.join(","));

        args = args.concat(codec.extra);
        args.push(outputFile);

        log("info", "FFmpeg: " + state.ffmpegPath + " " + args.join(" "));

        var proc = childProcess.spawn(state.ffmpegPath, args, {
            cwd: state.sessionFolder,
            windowsHide: true
        });

        var stderrData = "";

        proc.stderr.on("data", function (data) {
            var str = data.toString();
            stderrData += str;

            // Parse progress from ffmpeg stderr (frame= N)
            var frameMatch = str.match(/frame=\s*(\d+)/);
            if (frameMatch) {
                var currentFrame = parseInt(frameMatch[1], 10);
                var pct = Math.min(100, Math.round((currentFrame / state.frameCount) * 100));
                el.encodingFill.style.width = pct + "%";
                el.encodingStatus.textContent = "Encoding: " + pct + "% (" + currentFrame + "/" + state.frameCount + ")";
            }
        });

        proc.on("error", function (err) {
            state.encoding = false;
            el.encodingSection.style.display = "none";
            el.btnRecord.disabled = false;
            log("error", "FFmpeg error: " + err.message);
        });

        proc.on("close", function (code) {
            state.encoding = false;
            el.btnRecord.disabled = false;

            if (code === 0) {
                el.encodingFill.style.width = "100%";
                el.encodingSection.classList.add("encoding-done");
                el.encodingStatus.textContent = "Done!";
                log("success", "Video saved: " + outputFile);

                // Delete frames if checked
                if (state.deleteFrames) {
                    deleteFrameFiles();
                }

                // Hide encoding UI after 5 seconds
                setTimeout(function () {
                    el.encodingSection.style.display = "none";
                }, 5000);
            } else {
                el.encodingSection.style.display = "none";
                log("error", "FFmpeg exit code: " + code);
                // Show last few lines of stderr for debugging
                var lines = stderrData.trim().split("\n");
                var lastLines = lines.slice(-3).join(" | ");
                log("error", "FFmpeg: " + lastLines);
            }
        });
    }

    function deleteFrameFiles() {
        try {
            var files = fs.readdirSync(state.sessionFolder);
            var deleted = 0;
            for (var i = 0; i < files.length; i++) {
                if (files[i].match(/^frame_\d{5}\.jpg$/)) {
                    fs.unlinkSync(path.join(state.sessionFolder, files[i]));
                    deleted++;
                }
            }
            // Remove empty session folder
            try {
                var remaining = fs.readdirSync(state.sessionFolder);
                if (remaining.length === 0) {
                    fs.rmdirSync(state.sessionFolder);
                }
            } catch (e) { }
            log("info", "Deleted " + deleted + " frame files");
        } catch (e) {
            log("warning", "Could not delete frames: " + e.message);
        }
    }

    // ============ Folder / FFmpeg Selection ============
    function onSelectFolder() {
        evalScript("selectFolder()", function (result) {
            if (!result || result === "undefined" || result === "EvalScript error") return;
            try {
                var res = JSON.parse(result);
                if (res.cancelled) { log("info", "Folder selection cancelled"); return; }
                if (res.error) { log("error", "Folder error: " + res.message); return; }
                state.outputFolder = res.path;
                el.folderPath.textContent = shortenPath(res.path);
                el.folderPath.title = res.path;
                el.folderPath.classList.add("has-path");
                saveSettings();
                log("info", "Output folder: " + res.path);
            } catch (e) {
                log("error", "Parse error: " + e.message + " | Raw: " + result);
            }
        });
    }

    // ============ Settings Events ============
    function onIntervalChange() {
        var val = parseInt(el.intervalSlider.value, 10);
        el.intervalValue.textContent = val;
        state.intervalMs = val * 1000;
        saveSettings();
        if (state.recording && state.captureTimer) {
            // Restart capture interval with new interval
            var clrInt = nodeTimers ? nodeTimers.clearInterval : clearInterval;
            clrInt(state.captureTimer);
            var setInt = nodeTimers ? nodeTimers.setInterval : setInterval;
            state.captureTimer = setInt(captureLoop, state.intervalMs);
            log("info", "Interval changed: " + val + "s");
        }
    }

    function onFormatChange() {
        state.videoFormat = el.videoFormat.value;
        saveSettings();
    }

    function onFrameHoldChange() {
        state.frameHold = parseFloat(el.frameHold.value);
        saveSettings();
    }

    function onResScaleChange() {
        state.resScale = parseInt(el.resScale.value, 10);
        saveSettings();
    }

    function onDeleteFramesChange() {
        state.deleteFrames = el.chkDeleteFrames.checked;
        saveSettings();
    }

    function onCropChange() {
        state.cropTop = parseInt(el.cropTop.value, 10) || 0;
        state.cropLeft = parseInt(el.cropLeft.value, 10) || 0;
        state.cropRight = parseInt(el.cropRight.value, 10) || 0;
        state.cropBottom = parseInt(el.cropBottom.value, 10) || 0;
        saveSettings();
    }

    function onSmoothTransitionsChange() {
        state.smoothTransitions = el.chkSmoothTransitions.checked;
        saveSettings();
    }

    // ============ UI Updates ============
    function updateUI(mode) {
        switch (mode) {
            case "recording":
                el.mainUI.classList.add("hidden");
                el.minimalUI.classList.remove("hidden");
                csInterface.resizeContent(220, 60);

                el.statusBadge.className = "status-badge status-recording";
                el.statusText.textContent = "Recording...";
                el.btnRecord.disabled = true;
                el.btnRecord.classList.add("recording");
                el.btnPause.disabled = false;
                el.btnPause.querySelector("span").textContent = "Pause";
                el.btnStop.disabled = false;
                el.btnSelectFolder.disabled = true;
                el.btnSelectFFmpeg.disabled = true;
                el.videoFormat.disabled = true;
                el.frameHold.disabled = true;
                el.resScale.disabled = true;
                el.progressBar.style.display = "block";

                el.minDot.className = "min-dot";
                break;
            case "paused":
                el.statusBadge.className = "status-badge status-paused";
                el.statusText.textContent = "Paused";
                el.btnPause.querySelector("span").textContent = "Resume";
                el.minDot.className = "min-dot paused";
                break;
            case "idle":
                el.mainUI.classList.remove("hidden");
                el.minimalUI.classList.add("hidden");
                csInterface.resizeContent(320, 500);

                el.statusBadge.className = "status-badge status-idle";
                el.statusText.textContent = "Stopped";
                el.btnRecord.disabled = false;
                el.btnRecord.classList.remove("recording");
                el.btnPause.disabled = true;
                el.btnPause.querySelector("span").textContent = "Pause";
                el.btnStop.disabled = true;
                el.btnSelectFolder.disabled = false;
                el.btnSelectFFmpeg.disabled = false;
                el.videoFormat.disabled = false;
                el.frameHold.disabled = false;
                el.resScale.disabled = false;
                el.progressBar.style.display = "none";
                break;
        }
    }

    function updateElapsedTime() {
        if (!state.startTime) return;
        var elapsed = Date.now() - state.startTime - state.pausedTime;
        if (state.paused && state.pauseStart) {
            elapsed -= (Date.now() - state.pauseStart);
        }
        elapsed = Math.max(0, elapsed);
        var totalSec = Math.floor(elapsed / 1000);
        var min = Math.floor(totalSec / 60);
        var sec = totalSec % 60;
        var hours = Math.floor(min / 60);
        min = min % 60;

        if (hours > 0) {
            var ts = pad2(hours) + ":" + pad2(min) + ":" + pad2(sec);
            el.elapsedTime.textContent = ts;
            el.minTime.textContent = ts;
        } else {
            var ts = pad2(min) + ":" + pad2(sec);
            el.elapsedTime.textContent = ts;
            el.minTime.textContent = ts;
        }

        var estimatedMB = (state.frameCount * 0.2).toFixed(1);
        el.totalSize.textContent = estimatedMB + " MB";
    }

    function animateProgress() {
        el.progressFill.style.width = "0%";
        el.progressFill.offsetWidth; // reflow
        el.progressFill.style.transition = "width " + (state.intervalMs / 1000) + "s linear";
        el.progressFill.style.width = "100%";
    }

    // ============ Logging ============
    function log(type, message) {
        var entry = document.createElement("div");
        entry.className = "log-entry log-" + type;
        var time = new Date();
        var timeStr = pad2(time.getHours()) + ":" + pad2(time.getMinutes()) + ":" + pad2(time.getSeconds());
        entry.textContent = "[" + timeStr + "] " + message;
        el.logContainer.appendChild(entry);
        el.logContainer.scrollTop = el.logContainer.scrollHeight;
        while (el.logContainer.children.length > 200) {
            el.logContainer.removeChild(el.logContainer.firstChild);
        }
    }

    // ============ Helpers ============
    function evalScript(script, callback) {
        csInterface.evalScript(script, callback || function () { });
    }

    function escapeForScript(str) {
        return str.replace(/\\/g, "/").replace(/"/g, '\\"');
    }

    function shortenPath(p) {
        if (!p) return "";
        if (p.length <= 35) return p;
        var parts = p.replace(/\\/g, "/").split("/");
        if (parts.length <= 3) return p;
        return parts[0] + "/.../" + parts[parts.length - 2] + "/" + parts[parts.length - 1];
    }

    function pad2(n) {
        return n < 10 ? "0" + n : "" + n;
    }

    // ============ Start ============
    init();
})();
