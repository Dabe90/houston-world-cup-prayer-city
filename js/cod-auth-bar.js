/**
 * Keeps Firebase Auth visible across COD pages (dashboard link until sign-out).
 * Hides create-account / login CTAs once a portal login already exists.
 */
(function (global) {
  function portalForRole(role, profile) {
    var p = global.COD_PROGRAM_CTX && global.COD_PROGRAM_CTX.paths ? global.COD_PROGRAM_CTX.paths() : null;
    if (role === "admin") return { href: "/cod/admin.html", label: "President dashboard" };
    if (role === "coordinator") {
      return { href: p ? p.coordinator : "/cod/coordinator.html", label: "Coordinator portal" };
    }
    if (role === "pending_coordinator") {
      return { href: p ? p.pending : "/cod/coordinator-pending.html", label: "Coordinator (pending)" };
    }
    var studentHref =
      global.COD_PROGRAM_CTX && global.COD_PROGRAM_CTX.studentPortalForProfile
        ? global.COD_PROGRAM_CTX.studentPortalForProfile(profile)
        : "/cod/student.html";
    return { href: studentHref, label: "Student portal" };
  }

  function pathOf(href) {
    try {
      return new URL(href, window.location.origin).pathname.replace(/\/+$/, "") || "/";
    } catch (e) {
      return "";
    }
  }

  function isCreateAccountPath(pathname) {
    return (
      pathname === "/cod/register" ||
      pathname === "/cod/register.html" ||
      pathname === "/cod1024/register" ||
      pathname === "/cod1024/register.html"
    );
  }

  function isLoginPath(pathname) {
    return (
      pathname === "/cod/students" ||
      pathname === "/cod/login" ||
      pathname === "/cod/login.html" ||
      pathname === "/cod1024/students" ||
      pathname === "/cod1024/students.html" ||
      pathname === "/cod1024/coordinator-login" ||
      pathname === "/cod1024/coordinator-login.html" ||
      pathname === "/cod/coordinator-login" ||
      pathname === "/cod/coordinator-login.html"
    );
  }

  function setShown(el, shown) {
    if (!el) return;
    el.hidden = !shown;
    el.style.display = shown ? "" : "none";
  }

  function applySignedInVisibility(user) {
    var signedIn = !!user;
    document.querySelectorAll("[data-cod-hide-when-signed-in]").forEach(function (el) {
      setShown(el, !signedIn);
    });
    document.querySelectorAll("[data-cod-show-when-signed-in]").forEach(function (el) {
      setShown(el, signedIn);
    });
    document.querySelectorAll("a[href]").forEach(function (a) {
      if (a.hasAttribute("data-cod-hide-when-signed-in")) return;
      if (a.hasAttribute("data-cod-show-when-signed-in")) return;
      var pathname = pathOf(a.getAttribute("href"));
      if (isCreateAccountPath(pathname) || isLoginPath(pathname)) {
        setShown(a, !signedIn);
      }
    });
  }

  function mountNav(host, user, role, profile) {
    applySignedInVisibility(user);
    if (!host) return;
    host.innerHTML = "";
    var portal = user ? portalForRole(role, profile) : null;
    if (!user || !portal) {
      host.style.display = "none";
      return;
    }
    host.style.display = "flex";
    host.style.flexWrap = "wrap";
    host.style.gap = "8px";
    host.style.alignItems = "center";

    var dash = document.createElement("a");
    dash.className = "btn btn-primary";
    dash.href = portal.href;
    dash.textContent = portal.label;
    host.appendChild(dash);

    var ctx = global.COD_PROGRAM_CTX;
    var staff = role === "coordinator" || role === "admin";
    if (staff && ctx && ctx.paths && role !== "student") {
      var p = ctx.paths();
      var sw = document.createElement("a");
      sw.className = "btn btn-outline";
      sw.href = p.otherCoordinator;
      sw.textContent = "Switch to " + p.otherLabel;
      host.appendChild(sw);
    }

    var out = document.createElement("button");
    out.type = "button";
    out.className = "btn btn-outline";
    out.textContent = "Sign out";
    out.addEventListener("click", function () {
      global.COD_FIREBASE.auth()
        .signOut()
        .then(function () {
          var home =
            global.COD_PROGRAM_CTX && global.COD_PROGRAM_CTX.paths
              ? global.COD_PROGRAM_CTX.paths().home
              : "/cod/";
          window.location.href = home;
        });
    });
    host.appendChild(out);
  }

  function redirectSignedIn(user) {
    if (!user || !global.COD_FIREBASE) return;
    global.COD_FIREBASE.resolveRole(user).then(function (role) {
      if (role === "student") {
        return global.COD_FIREBASE.getProfile(user.uid).then(function (p) {
          window.location.replace(portalForRole(role, p).href);
        });
      }
      window.location.replace(portalForRole(role).href);
    });
  }

  function initAuthBar() {
    if (!global.COD_FIREBASE || !global.COD_FIREBASE.init()) return;
    var host =
      document.querySelector("[data-cod-auth-nav]") ||
      document.getElementById("cod-auth-nav");
    var current = global.COD_FIREBASE.auth().currentUser;
    if (current) applySignedInVisibility(current);
    global.COD_FIREBASE.auth().onAuthStateChanged(function (user) {
      if (!user) {
        mountNav(host, null, null);
        return;
      }
      global.COD_FIREBASE.resolveRole(user).then(function (role) {
        if (role === "student") {
          return global.COD_FIREBASE.getProfile(user.uid).then(function (p) {
            mountNav(host, user, role, p);
          });
        }
        mountNav(host, user, role);
      });
    });
  }

  global.COD_AUTH_BAR = {
    redirectSignedIn: redirectSignedIn,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuthBar);
  } else {
    initAuthBar();
  }
})(typeof window !== "undefined" ? window : global);
