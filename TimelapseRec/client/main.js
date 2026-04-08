

(function () {
    "use strict";

    var csInterface = new CSInterface();
    var path, fs, childProcess, nodeTimers, https;
    try {
        path = require("path");
        fs = require("fs");
        childProcess = require("child_process");
        nodeTimers = require("timers");
        https = require("https");
    } catch (e) {

    }

    var REPO_OWNER = "Solartion";
    var REPO_NAME = "Plugin_Rec";

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
        recordingDocName: "",
        mouseDown: false,
        mouseWatcher: null,
        updating: false,
        pendingUpdateSha: ""
    };

    var CODECS = {
        mp4: { ext: "mp4", vcodec: "libx264", pix: "yuv420p", extra: ["-preset", "medium", "-crf", "23"] },
        mkv: { ext: "mkv", vcodec: "libx264", pix: "yuv420p", extra: ["-preset", "medium", "-crf", "23"] },
        mov: { ext: "mov", vcodec: "libx264", pix: "yuv420p", extra: ["-preset", "medium", "-crf", "23"] },
        avi: { ext: "avi", vcodec: "mjpeg", pix: "yuvj420p", extra: ["-q:v", "3"] },
        webm: { ext: "webm", vcodec: "libvpx-vp9", pix: "yuv420p", extra: ["-b:v", "2M", "-crf", "30"] }
    };

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
        btnUpdate: document.getElementById("btnUpdate"),
        chkDeleteFrames: document.getElementById("chkDeleteFrames"),
        logContainer: document.getElementById("logContainer"),
        encodingSection: document.getElementById("encodingSection"),
        encodingStatus: document.getElementById("encodingStatus"),
        encodingFill: document.getElementById("encodingFill"),

        updateBanner: document.getElementById("updateBanner"),
        updateMessage: document.getElementById("updateMessage"),
        updateProgress: document.getElementById("updateProgress"),
        updateProgressFill: document.getElementById("updateProgressFill"),

        mainUI: document.getElementById("mainUI"),
        minimalUI: document.getElementById("minimalUI"),
        minDot: document.getElementById("minDot"),
        minTime: document.getElementById("minTime"),
        btnMinPause: document.getElementById("btnMinPause"),
        btnMinStop: document.getElementById("btnMinStop"),
        cropTop: document.getElementById("cropTop"),
        cropLeft: document.getElementById("cropLeft"),
        cropRight: document.getElementById("cropRight"),
        cropBottom: document.getElementById("cropBottom")
    };

    function init() {
        loadSettings();
        bindEvents();
        refreshDocInfo();

        csInterface.addEventListener("documentAfterActivate", refreshDocInfo);
        csInterface.addEventListener("documentAfterDeactivate", refreshDocInfo);

        if (childProcess) {
            setTimeout(detectFFmpeg, 2000);
        }

        // Auto-update check after 5 seconds
        if (https && fs) {
            setTimeout(checkForUpdates, 5000);
        }

        window.addEventListener("beforeunload", function () {
            var clrInt = nodeTimers ? nodeTimers.clearInterval : clearInterval;
            if (state.captureTimer) clrInt(state.captureTimer);
            stopMouseWatcher();
        });

        log("info", "Timelapse Rec v2.0 loaded.");
    }

    function bindEvents() {
        el.btnRecord.addEventListener("click", onRecordClick);
        el.btnPause.addEventListener("click", onPauseClick);
        el.btnStop.addEventListener("click", onStopClick);
        el.btnSelectFolder.addEventListener("click", onSelectFolder);
        el.btnSelectFFmpeg.addEventListener("click", onSelectFFmpeg);
        el.btnUpdate.addEventListener("click", onUpdateClick);
        el.intervalSlider.addEventListener("input", onIntervalChange);
        el.videoFormat.addEventListener("change", onFormatChange);
        el.frameHold.addEventListener("change", onFrameHoldChange);
        el.resScale.addEventListener("change", onResScaleChange);
        el.chkDeleteFrames.addEventListener("change", onDeleteFramesChange);

        el.btnMinPause.addEventListener("click", onPauseClick);
        el.btnMinStop.addEventListener("click", onStopClick);
    }

    function detectFFmpeg() {

        if (state.ffmpegPath && fs.existsSync(state.ffmpegPath)) {
            setFFmpegUI(state.ffmpegPath);
            return;
        }

        var candidates = [];

        try {
            var dirName = __dirname || "";
            if (dirName) {
                candidates.push(path.resolve(dirName, "..", "tools", "ffmpeg.exe"));
            }
        } catch (e) { }

        try {
            var extPath = csInterface.getSystemPath("extension");
            if (extPath) {

                var normalized = extPath.replace(/^\/([a-zA-Z])\//, "$1:/").replace(/\//g, "\\");
                candidates.push(path.join(normalized, "tools", "ffmpeg.exe"));
                candidates.push(path.join(extPath, "tools", "ffmpeg.exe"));
            }
        } catch (e) { }

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

    function loadSettings() {
        try {
            var saved = localStorage.getItem("timelapseRecSettings_v2");
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
            }
        } catch (e) { }
    }

    function saveSettings() {
        try {
            localStorage.setItem("timelapseRecSettings_v2", JSON.stringify({
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
                cropBottom: state.cropBottom
            }));
        } catch (e) { }
    }

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
                log("info", "Interval: " + (state.intervalMs / 1000) + "s | Format: " + state.videoFormat.toUpperCase() + " | Doc: " + docInfo.name + " | Smooth ON");

                startMouseWatcher();

                state.captureBusy = false;
                state.captureLastTime = Date.now();
                var setInt2 = nodeTimers ? nodeTimers.setInterval : setInterval;
                state.captureTimer = setInt2(captureLoop, state.intervalMs);

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

    function captureLoop() {
        if (!state.recording || state.paused) return;

        if (state.mouseDown) return;


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

    function encodeVideo() {
        state.encoding = true;
        var codec = CODECS[state.videoFormat];


        var sessionNorm = state.sessionFolder.replace(/\\/g, "/");
        var outputNorm = state.outputFolder.replace(/\\/g, "/");
        var inputPattern = sessionNorm + "/frame_%05d.jpg";
        var outputFile = outputNorm + "/" + state.sessionName + "." + codec.ext;

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

            vfFilters.push("scale=iw/" + sf + ":ih/" + sf);
        }

        vfFilters.push("crop=trunc(iw/2)*2:trunc(ih/2)*2");

        // Always apply smooth transitions (crossfade)
        vfFilters.push("framerate=fps=30:interp_start=0:interp_end=255:scene=100");

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

                if (state.deleteFrames) {
                    deleteFrameFiles();
                }

                setTimeout(function () {
                    el.encodingSection.style.display = "none";
                }, 5000);
            } else {
                el.encodingSection.style.display = "none";
                log("error", "FFmpeg exit code: " + code);

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

    function onIntervalChange() {
        var val = parseInt(el.intervalSlider.value, 10);
        el.intervalValue.textContent = val;
        state.intervalMs = val * 1000;
        saveSettings();
        if (state.recording && state.captureTimer) {

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

    // ========== AUTO-UPDATE SYSTEM ==========

    function getPluginRootDir() {
        // Plugin structure: Plugin_Rec/TimelapseRec/client/main.js
        // We need to get to Plugin_Rec/
        try {
            var clientDir = __dirname || "";
            if (clientDir) {
                return path.resolve(clientDir, "..", "..");
            }
        } catch (e) { }

        try {
            var extPath = csInterface.getSystemPath("extension");
            if (extPath) {
                var normalized = extPath.replace(/^\/([a-zA-Z])\//, "$1:/").replace(/\//g, "\\");
                return path.resolve(normalized, "..");
            }
        } catch (e) { }

        return null;
    }

    function checkForUpdates() {
        var pluginRoot = getPluginRootDir();
        if (!pluginRoot) {
            log("warning", "Auto-update: cannot determine plugin root dir");
            return;
        }

        var versionPath = path.join(pluginRoot, "version.txt");
        var localVersion = "";
        try {
            if (fs.existsSync(versionPath)) {
                localVersion = fs.readFileSync(versionPath, "utf8").trim();
            }
        } catch (e) {
            log("warning", "Auto-update: cannot read version.txt");
            return;
        }

        log("info", "Checking for updates...");

        var options = {
            hostname: "api.github.com",
            path: "/repos/" + REPO_OWNER + "/" + REPO_NAME + "/commits/main",
            headers: { "User-Agent": "TimelapseRec-Plugin" },
            timeout: 10000
        };

        var req = https.get(options, function (res) {
            var data = "";
            res.on("data", function (chunk) { data += chunk; });
            res.on("end", function () {
                try {
                    if (res.statusCode !== 200) {
                        log("warning", "Update check: GitHub API returned " + res.statusCode);
                        return;
                    }
                    var json = JSON.parse(data);
                    var remoteSha = json.sha;
                    if (!remoteSha) {
                        log("warning", "Update check: no SHA in response");
                        return;
                    }

                    if (remoteSha !== localVersion) {
                        state.pendingUpdateSha = remoteSha;
                        showUpdateBanner(remoteSha);
                        log("info", "Update available: " + remoteSha.substring(0, 8));
                    } else {
                        log("info", "Plugin is up to date.");
                    }
                } catch (e) {
                    log("warning", "Update check parse error: " + e.message);
                }
            });
        });

        req.on("error", function (err) {
            log("warning", "Update check failed: " + err.message);
        });

        req.on("timeout", function () {
            req.abort();
            log("warning", "Update check timed out");
        });
    }

    function showUpdateBanner(sha) {
        el.updateBanner.classList.remove("hidden");
        el.updateMessage.textContent = "\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u043e \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 (" + sha.substring(0, 8) + ")";
        el.btnUpdate.disabled = false;
        el.btnUpdate.textContent = "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c";
    }

    function onUpdateClick() {
        if (state.updating) return;
        if (state.recording) {
            log("warning", "Cannot update while recording");
            return;
        }

        var pluginRoot = getPluginRootDir();
        if (!pluginRoot) {
            log("error", "Update: cannot determine plugin root dir");
            return;
        }

        state.updating = true;
        el.btnUpdate.disabled = true;
        el.btnUpdate.textContent = "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...";
        el.updateBanner.className = "update-banner updating";
        el.updateProgress.classList.remove("hidden");
        el.updateProgressFill.style.width = "10%";
        el.updateMessage.textContent = "\u0421\u043a\u0430\u0447\u0438\u0432\u0430\u043d\u0438\u0435 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f...";
        log("info", "Downloading update...");

        var timestamp = Date.now();
        var tempDir = process.env.TEMP || process.env.TMP || "C:\\Temp";
        var tempZip = path.join(tempDir, "plugin_update_" + timestamp + ".zip");
        var tempExtract = path.join(tempDir, "plugin_update_" + timestamp);

        // Download the zip from GitHub API (follows redirects)
        var zipUrl = "/repos/" + REPO_OWNER + "/" + REPO_NAME + "/zipball/main";
        downloadFile("api.github.com", zipUrl, tempZip, function (err) {
            if (err) {
                onUpdateError("Download failed: " + err);
                return;
            }

            el.updateProgressFill.style.width = "40%";
            el.updateMessage.textContent = "\u0420\u0430\u0441\u043f\u0430\u043a\u043e\u0432\u043a\u0430...";
            el.btnUpdate.textContent = "\u0423\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430...";
            log("info", "Download complete. Extracting...");

            // Extract using PowerShell Expand-Archive
            var psCmd = "Expand-Archive -Path '" + tempZip.replace(/'/g, "''") + "' -DestinationPath '" + tempExtract.replace(/'/g, "''") + "' -Force";
            childProcess.exec("powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \"" + psCmd + "\"", {
                timeout: 60000,
                windowsHide: true
            }, function (err2) {
                if (err2) {
                    onUpdateError("Extraction failed: " + err2.message);
                    cleanupTemp(tempZip, tempExtract);
                    return;
                }

                el.updateProgressFill.style.width = "60%";
                el.updateMessage.textContent = "\u041a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0444\u0430\u0439\u043b\u043e\u0432...";
                log("info", "Extraction complete. Copying files...");

                // Find the extracted root folder (GitHub wraps in Owner-Repo-SHA/)
                try {
                    var extractedItems = fs.readdirSync(tempExtract);
                    var extractedRoot = "";
                    for (var i = 0; i < extractedItems.length; i++) {
                        var itemPath = path.join(tempExtract, extractedItems[i]);
                        if (fs.statSync(itemPath).isDirectory()) {
                            extractedRoot = itemPath;
                            break;
                        }
                    }

                    if (!extractedRoot) {
                        onUpdateError("No folder found in extracted archive");
                        cleanupTemp(tempZip, tempExtract);
                        return;
                    }

                    el.updateProgressFill.style.width = "70%";

                    // Files/dirs to never overwrite
                    var EXCLUDE = ["version.txt", ".git", "backups", "update.log", "update_available.txt"];
                    var EXCLUDE_FILES = ["ffmpeg.exe", "ffprobe.exe"];

                    copyDirRecursive(extractedRoot, pluginRoot, EXCLUDE, EXCLUDE_FILES);

                    el.updateProgressFill.style.width = "90%";

                    // Update version.txt with new SHA
                    if (state.pendingUpdateSha) {
                        var versionPath = path.join(pluginRoot, "version.txt");
                        fs.writeFileSync(versionPath, state.pendingUpdateSha, "utf8");
                        log("info", "version.txt updated to " + state.pendingUpdateSha.substring(0, 8));
                    }

                    el.updateProgressFill.style.width = "100%";
                    el.updateBanner.className = "update-banner update-done";
                    el.updateMessage.textContent = "\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u043e! \u041f\u0435\u0440\u0435\u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u0435 Photoshop.";
                    el.btnUpdate.textContent = "\u0413\u043e\u0442\u043e\u0432\u043e \u2713";
                    el.btnUpdate.disabled = true;
                    state.updating = false;
                    log("success", "Update installed successfully! Restart Photoshop to apply.");

                } catch (copyErr) {
                    onUpdateError("Copy failed: " + copyErr.message);
                }

                cleanupTemp(tempZip, tempExtract);
            });
        });
    }

    function downloadFile(hostname, urlPath, destPath, callback) {
        var options = {
            hostname: hostname,
            path: urlPath,
            headers: { "User-Agent": "TimelapseRec-Plugin" },
            timeout: 60000
        };

        https.get(options, function (res) {
            // Follow redirects (GitHub API returns 302)
            if (res.statusCode === 301 || res.statusCode === 302) {
                var redirectUrl = res.headers.location;
                if (!redirectUrl) {
                    callback("Redirect with no location header");
                    return;
                }
                var urlModule = require("url");
                var parsed = urlModule.parse(redirectUrl);
                downloadFile(parsed.hostname, parsed.path, destPath, callback);
                return;
            }

            if (res.statusCode !== 200) {
                callback("HTTP " + res.statusCode);
                return;
            }

            var fileStream = fs.createWriteStream(destPath);
            res.pipe(fileStream);
            fileStream.on("finish", function () {
                fileStream.close();
                callback(null);
            });
            fileStream.on("error", function (err) {
                try { fs.unlinkSync(destPath); } catch (e) { }
                callback(err.message);
            });
        }).on("error", function (err) {
            callback(err.message);
        });
    }

    function copyDirRecursive(src, dest, excludeDirs, excludeFiles) {
        var items = fs.readdirSync(src);
        for (var i = 0; i < items.length; i++) {
            var itemName = items[i];

            // Check top-level dir exclusions
            var skip = false;
            for (var e = 0; e < excludeDirs.length; e++) {
                if (itemName === excludeDirs[e]) { skip = true; break; }
            }
            if (skip) continue;

            var srcPath = path.join(src, itemName);
            var destPath = path.join(dest, itemName);
            var stat = fs.statSync(srcPath);

            if (stat.isDirectory()) {
                if (!fs.existsSync(destPath)) {
                    fs.mkdirSync(destPath, { recursive: true });
                }
                // Only exclude dirs at top level
                copyDirRecursive(srcPath, destPath, [], excludeFiles);
            } else {
                // Check file exclusions
                var skipFile = false;
                for (var f = 0; f < excludeFiles.length; f++) {
                    if (itemName === excludeFiles[f]) { skipFile = true; break; }
                }
                if (skipFile) continue;

                try {
                    var fileData = fs.readFileSync(srcPath);
                    fs.writeFileSync(destPath, fileData);
                } catch (writeErr) {
                    log("warning", "Could not update: " + itemName + " (" + writeErr.message + ")");
                }
            }
        }
    }

    function onUpdateError(msg) {
        state.updating = false;
        el.updateBanner.className = "update-banner update-error";
        el.updateMessage.textContent = "\u041e\u0448\u0438\u0431\u043a\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f";
        el.btnUpdate.textContent = "\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c";
        el.btnUpdate.disabled = false;
        log("error", "Update error: " + msg);
    }

    function cleanupTemp(zipPath, extractPath) {
        try { fs.unlinkSync(zipPath); } catch (e) { }
        try {
            childProcess.exec('rmdir /s /q "' + extractPath + '"', { windowsHide: true }, function () { });
        } catch (e) { }
    }

    init();
})();
