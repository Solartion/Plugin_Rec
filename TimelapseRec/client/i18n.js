var i18n = {
    currentLang: "ru",

    languages: {
        ru: "Русский",
        en: "English",
        zh: "中文"
    },

    dict: {
        // Statuses
        status_stopped: { ru: "Остановлено", en: "Stopped", zh: "已停止" },
        status_recording: { ru: "Запись...", en: "Recording...", zh: "录制中..." },
        status_paused: { ru: "Пауза", en: "Paused", zh: "已暂停" },

        // Document Info
        doc_placeholder: { ru: "Откройте документ для начала", en: "Open a document to start", zh: "打开文档以开始" },
        
        // Update Banner
        update_available: { ru: "Доступно обновление", en: "Update available", zh: "有可用更新" },
        btn_update: { ru: "Обновить", en: "Update", zh: "更新" },

        // Controls
        btn_record: { ru: "Запись", en: "Record", zh: "录制" },
        btn_pause: { ru: "Пауза", en: "Pause", zh: "暂停" },
        btn_resume: { ru: "Продолжить", en: "Resume", zh: "恢复" },
        btn_stop: { ru: "Стоп", en: "Stop", zh: "停止" },

        // Stats
        stat_frames: { ru: "Кадров", en: "Frames", zh: "帧数" },
        stat_time: { ru: "Время записи", en: "Record Time", zh: "录制时间" },
        stat_size: { ru: "Размер", en: "Size", zh: "大小" },

        // Encoding section
        encoding_video: { ru: "Кодирование видео...", en: "Encoding video...", zh: "正在编码视频..." },

        // Settings
        settings_title: { ru: "Настройки", en: "Settings", zh: "设置" },
        language_label: { ru: "Язык:", en: "Language:", zh: "语言:" },
        interval_label: { ru: "Интервал:", en: "Interval:", zh: "间隔:" },
        sec: { ru: "сек", en: "sec", zh: "秒" },
        video_format: { ru: "Формат видео:", en: "Video Format:", zh: "视频格式:" },
        frame_hold: { ru: "Длительность кадра:", en: "Frame Hold:", zh: "帧持续时间:" },
        res_scale: { ru: "Размер кадра:", en: "Frame Size:", zh: "帧大小:" },
        folder_label: { ru: "Папка сохранения:", en: "Output Folder:", zh: "输出文件夹:" },
        not_selected: { ru: "Не выбрана", en: "Not selected", zh: "未选择" },
        btn_select: { ru: "Выбрать", en: "Select", zh: "选择" },
        ffmpeg_label: { ru: "FFmpeg:", en: "FFmpeg:", zh: "FFmpeg:" },
        not_found: { ru: "Не найден", en: "Not found", zh: "未找到" },
        btn_specify: { ru: "Указать", en: "Specify", zh: "指定" },
        delete_frames: { ru: "Удалить кадры после кодирования", en: "Delete frames after encoding", zh: "编码后删除帧" },

        // Frame Hold Options
        fh_01: { ru: "0.1 - очень быстро", en: "0.1 - very fast", zh: "0.1 - 非常快" },
        fh_025: { ru: "0.25 - быстро", en: "0.25 - fast", zh: "0.25 - 快" },
        fh_05: { ru: "0.5 - нормально", en: "0.5 - normal", zh: "0.5 - 正常" },
        fh_10: { ru: "1.0 - медленно", en: "1.0 - slow", zh: "1.0 - 慢" },
        fh_15: { ru: "1.5", en: "1.5", zh: "1.5" },
        fh_20: { ru: "2.0 - очень медленно", en: "2.0 - very slow", zh: "2.0 - 非常慢" },
        fh_30: { ru: "3.0", en: "3.0", zh: "3.0" },

        // Res Scale Options
        rs_orig: { ru: "100% (Оригинал)", en: "100% (Original)", zh: "100% (原始)" },
        rs_half: { ru: "50% (1/2 размера)", en: "50% (1/2 size)", zh: "50% (1/2 大小)" },
        rs_quarter: { ru: "25% (1/4 размера)", en: "25% (1/4 size)", zh: "25% (1/4 大小)" },

        // Log section
        log_title: { ru: "Журнал", en: "Log", zh: "日志" },
        log_loaded: { ru: "Плагин загружен. Укажите FFmpeg, папку и начните запись.", en: "Plugin loaded. Specify FFmpeg, folder and start recording.", zh: "插件已加载。指定FFmpeg、文件夹并开始录制。" },

        // Dynamic texts (for use in main.js)
        err_ffmpeg_missing: { ru: "Сначала укажите путь к FFmpeg", en: "Specify FFmpeg path first", zh: "请先指定FFmpeg路径" },
        err_folder_missing: { ru: "Сначала выберите папку сохранения", en: "Select output folder first", zh: "请先选择输出文件夹" },
        err_no_doc: { ru: "Откройте документ перед записью", en: "Open a document before recording", zh: "录制前请打开一个文档" },
        msg_recording_start: { ru: "Запись начата:", en: "Recording started:", zh: "录制开始:" },
        msg_recording_resumed: { ru: "Запись возобновлена", en: "Recording resumed", zh: "录制已恢复" },
        msg_recording_paused: { ru: "Запись приостановлена", en: "Recording paused", zh: "录制已暂停" },
        msg_recording_stopped: { ru: "Запись остановлена. Кадров:", en: "Recording stopped. Frames:", zh: "录制停止。帧数:" },
        msg_no_frames: { ru: "Нет кадров для кодирования", en: "No frames to encode", zh: "没有可编码的帧" },
        msg_encoding: { ru: "Кодирование", en: "Encoding", zh: "编码" },
        msg_done: { ru: "Готово!", en: "Done!", zh: "完成！" },
        msg_video_saved: { ru: "Видео сохранено:", en: "Video saved:", zh: "视频已保存:" },

        // Dynamic Update texts
        upd_loading: { ru: "Загрузка...", en: "Loading...", zh: "加载中..." },
        upd_downloading: { ru: "Скачивание обновления...", en: "Downloading update...", zh: "正在下载更新..." },
        upd_extracting: { ru: "Распаковка...", en: "Extracting...", zh: "正在解压..." },
        upd_installing: { ru: "Установка...", en: "Installing...", zh: "安装中..." },
        upd_copying: { ru: "Копирование файлов...", en: "Copying files...", zh: "正在复制文件..." },
        upd_success: { ru: "Обновление установлено! Перезапустите Photoshop.", en: "Update installed! Restart Photoshop.", zh: "更新已安装！请重启Photoshop。" },
        btn_done: { ru: "Готово ✓", en: "Done ✓", zh: "完成 ✓" },
        upd_err: { ru: "Ошибка обновления", en: "Update error", zh: "更新错误" },
        btn_retry: { ru: "Повторить", en: "Retry", zh: "重试" }
    },

    t: function (key) {
        if (!this.dict[key]) return key;
        return this.dict[key][this.currentLang] || this.dict[key]["en"] || key;
    },

    setLang: function (lang) {
        if (this.languages[lang]) {
            this.currentLang = lang;
            this.applyTranslations();
        }
    },

    applyTranslations: function () {
        var elements = document.querySelectorAll("[data-i18n]");
        for (var i = 0; i < elements.length; i++) {
            var key = elements[i].getAttribute("data-i18n");
            var trans = this.t(key);
            if (elements[i].tagName === "INPUT" && elements[i].type === "button") {
                elements[i].value = trans;
            } else {
                elements[i].textContent = trans;
            }
        }
    }
};
