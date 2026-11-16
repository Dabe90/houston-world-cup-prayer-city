/**
 * Which Class of David program this page belongs to.
 * Coordinators may switch programs. Students stay in the program they registered for.
 */
(function (global) {
  function current() {
    if (global.COD_PROGRAM === "cod1024") return "cod1024";
    if (typeof location !== "undefined" && /\/cod1024/.test(location.pathname)) return "cod1024";
    return "cod";
  }

  function is1024() {
    return current() === "cod1024";
  }

  function belongs(data) {
    var p = data && data.program;
    if (is1024()) return p === "cod1024";
    return !p || p === "cod";
  }

  function paths() {
    if (is1024()) {
      return {
        home: "/cod1024",
        register: "/cod1024/register",
        studentsLogin: "/cod1024/students",
        student: "/cod1024/student",
        coordinator: "/cod1024/coordinator",
        coordLogin: "/cod1024/coordinator-login",
        coordRegister: "/cod1024/coordinator-register",
        pending: "/cod1024/coordinator-pending",
        otherHome: "/cod/",
        otherCoordinator: "/cod/coordinator.html",
        otherLabel: "9-month Class of David",
        label: "Class of David 1024",
      };
    }
    return {
      home: "/cod/",
      register: "/cod/register",
      studentsLogin: "/cod/students",
      student: "/cod/student.html",
      coordinator: "/cod/coordinator.html",
      coordLogin: "/cod/coordinator-login.html",
      coordRegister: "/cod/coordinator-register.html",
      pending: "/cod/coordinator-pending.html",
      otherHome: "/cod1024",
      otherCoordinator: "/cod1024/coordinator",
      otherLabel: "Class of David 1024",
      label: "Class of David",
    };
  }

  function studentPortalForProfile(profile) {
    if (profile && profile.program === "cod1024") return "/cod1024/student";
    return "/cod/student.html";
  }

  global.COD_PROGRAM_CTX = {
    current: current,
    is1024: is1024,
    belongs: belongs,
    paths: paths,
    studentPortalForProfile: studentPortalForProfile,
  };
})(typeof window !== "undefined" ? window : this);
