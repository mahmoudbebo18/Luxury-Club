// "Dasman Members" join form: emails each registration to the client (Web3Forms)
// and shows a live count of registered members (Firestore REST API).
// Keys live in js/config.js.
(function() {
    var form = document.getElementById("joinForm");
    if (!form) return;

    var config = window.DASMAN_CONFIG || {};
    var isArabic = document.documentElement.lang === "ar";
    var messages = isArabic ? {
        success: "تم استلام تسجيلك بنجاح! سيتواصل معك فريق دسمان قريباً.",
        error: "تعذّر إرسال التسجيل، الرجاء المحاولة مرة أخرى.",
        unavailable: "التسجيل غير متاح حالياً، الرجاء المحاولة لاحقاً."
    } : {
        success: "Your registration has been received! The DASMAN team will contact you soon.",
        error: "We couldn't send your registration. Please try again.",
        unavailable: "Registration is not available right now. Please try again later."
    };

    var submitButton = form.querySelector(".join-submit");
    var statusBox = form.querySelector(".form-status");

    // ---------- Registered-members counter ----------
    var firebase = config.firebase || {};
    var counterBox = document.querySelector(".member-counter");
    var counterNumber = counterBox && counterBox.querySelector("[data-count]");
    var counterEnabled = Boolean(counterBox && firebase.apiKey && firebase.projectId);
    var databasePath = "projects/" + firebase.projectId + "/databases/(default)/documents";
    var firestoreUrl = "https://firestore.googleapis.com/v1/" + databasePath;
    var memberCount = null;

    function formatNumber(n) {
        return n.toLocaleString("en-US");
    }

    function whenVisible(element, callback) {
        if (!("IntersectionObserver" in window)) return callback();
        var observer = new IntersectionObserver(function(entries) {
            if (entries[0].isIntersecting) {
                observer.disconnect();
                callback();
            }
        }, { threshold: 0.4 });
        observer.observe(element);
    }

    function countUp(target) {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            counterNumber.textContent = formatNumber(target);
            return;
        }
        var duration = 1600;
        var start = null;
        function step(time) {
            if (start === null) start = time;
            var progress = Math.min((time - start) / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            counterNumber.textContent = formatNumber(Math.round(target * eased));
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    function loadMemberCount() {
        fetch(firestoreUrl + "/stats/members?key=" + firebase.apiKey)
            .then(function(res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            })
            .then(function(doc) {
                var field = doc.fields.count;
                memberCount = Number(field.integerValue || field.doubleValue) || 0;
                counterBox.hidden = false;
                whenVisible(counterBox, function() {
                    countUp(memberCount);
                });
            })
            .catch(function(err) {
                console.warn("Member counter unavailable:", err);
            });
    }

    function incrementMemberCount() {
        if (!counterEnabled) return;
        fetch(firestoreUrl + ":commit?key=" + firebase.apiKey, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                writes: [{
                    transform: {
                        document: databasePath + "/stats/members",
                        fieldTransforms: [{ fieldPath: "count", increment: { integerValue: "1" } }]
                    }
                }]
            })
        })
            .then(function(res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                if (memberCount === null) return;
                memberCount += 1;
                counterNumber.textContent = formatNumber(memberCount);
                counterBox.classList.remove("is-bumped");
                void counterBox.offsetWidth; // restart the CSS animation
                counterBox.classList.add("is-bumped");
            })
            .catch(function(err) {
                console.warn("Could not update member counter:", err);
            });
    }

    if (counterEnabled) loadMemberCount();

    // ---------- Form submission ----------
    function showStatus(type, message) {
        statusBox.className = "form-status is-" + type;
        statusBox.textContent = message;
    }

    function setLoading(isLoading) {
        form.classList.toggle("is-loading", isLoading);
        submitButton.disabled = isLoading;
    }

    function value(name) {
        return form.elements[name].value.trim();
    }

    form.addEventListener("submit", function(e) {
        e.preventDefault();
        statusBox.className = "form-status";
        statusBox.textContent = "";

        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            var firstInvalid = form.querySelector(":invalid");
            if (firstInvalid) firstInvalid.focus();
            return;
        }

        if (!config.web3formsKey) {
            console.error("Join form: web3formsKey is missing in js/config.js");
            showStatus("error", messages.unavailable);
            return;
        }

        // Field names are in Arabic so every email reads the same for the client.
        var payload = {
            access_key: config.web3formsKey,
            subject: "تسجيل عضو جديد في دسمان - " + value("name"),
            from_name: "موقع دسمان",
            "الاسم": value("name"),
            "الجامعة": value("university"),
            "السنة الدراسية": value("year"),
            "الحي السكني": value("district"),
            "رقم الهاتف": value("phone"),
            email: value("email"),
            "ملاحظات واقتراحات واهتمامات": value("notes") || "-",
            "لغة الصفحة": isArabic ? "العربية" : "English",
            botcheck: form.elements.botcheck.checked
        };

        setLoading(true);
        fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(payload)
        })
            .then(function(res) {
                return res.json();
            })
            .then(function(result) {
                if (!result.success) throw new Error(result.message || "Web3Forms rejected the submission");
                form.reset();
                form.classList.remove("was-validated");
                showStatus("success", messages.success);
                incrementMemberCount();
            })
            .catch(function(err) {
                console.error("Join form:", err);
                showStatus("error", messages.error);
            })
            .then(function() {
                setLoading(false);
            });
    });
})();
