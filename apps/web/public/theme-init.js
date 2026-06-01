(function () {
  try {
    var t = sessionStorage.getItem("flowdesk:activeBusinessType");
    if (t) document.documentElement.setAttribute("data-business-type", t);
  } catch (e) {}
})();
