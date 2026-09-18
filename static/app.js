// 홈: 연식·제조사·차종 선택 + VIN 해독 / 차종 페이지: 연식 필터. 서버 없이 브라우저에서만 돈다.
(function () {
  var $ = function (id) { return document.getElementById(id); };

  // ---- 차종 페이지: 연식 필터 ----
  var chips = document.querySelectorAll("[data-year-chip]");
  if (chips.length) {
    var cards = document.querySelectorAll("[data-years]");
    var pick = function (y) {
      chips.forEach(function (c) { c.setAttribute("aria-pressed", c.dataset.yearChip === y ? "true" : "false"); });
      var shown = 0;
      cards.forEach(function (c) {
        var on = !y || (" " + c.dataset.years + " ").indexOf(" " + y + " ") >= 0;
        c.hidden = !on; if (on) shown++;
      });
      var n = $("year-count");
      if (n) n.textContent = y ? shown + " recall" + (shown === 1 ? "" : "s") + " cover the " + y + " model year." : "";
    };
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        var y = c.dataset.yearChip;
        history.replaceState(null, "", y ? "#y" + y : location.pathname);
        pick(y);
      });
    });
    var m = /^#y(\d{4})$/.exec(location.hash);
    if (m) pick(m[1]);
  }

  // ---- 홈: 찾기 ----
  var form = $("finder");
  if (!form) return;
  var selY = $("f-year"), selMk = $("f-make"), selMo = $("f-model"), msg = $("f-msg"), idx = null;

  var fill = function (sel, items, label) {
    sel.innerHTML = "";
    sel.add(new Option(label, ""));
    items.forEach(function (it) { sel.add(new Option(it[1], it[0])); });
    sel.disabled = !items.length;
  };
  var modelsFor = function (mk, y) {
    var out = [], ms = idx[mk].m;
    Object.keys(ms).forEach(function (k) { if (!y || ms[k].y[y] !== undefined) out.push([k, ms[k].t]); });
    return out;
  };
  var go = function (mk, mo, y) {
    var a = idx[mk], b = a.m[mo];
    if (y && b.y[y] === 1) location.href = "/used/" + a.s + "/" + b.s + "/" + y + "/";
    else location.href = "/" + a.s + "/" + b.s + "/" + (y && b.y[y] !== undefined ? "#y" + y : "");
  };

  fetch("/static/index.json").then(function (r) { return r.json(); }).then(function (j) {
    idx = j.makes;
    fill(selY, j.years.slice().reverse().map(function (y) { return [y, y]; }), "Any year");
    fill(selMk, Object.keys(idx).map(function (k) { return [k, idx[k].t]; }), "Make");
    fill(selMo, [], "Model");
  });
  var refresh = function () { fill(selMo, selMk.value ? modelsFor(selMk.value, selY.value) : [], "Model"); };
  selMk.addEventListener("change", refresh);
  selY.addEventListener("change", refresh);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!selMk.value) { msg.textContent = "Pick a make first."; return; }
    if (!selMo.value) { location.href = "/" + idx[selMk.value].s + "/"; return; }
    go(selMk.value, selMo.value, selY.value);
  });

  // ---- 홈: VIN ----
  var vform = $("vin-form");
  vform.addEventListener("submit", function (e) {
    e.preventDefault();
    var vin = $("vin").value.trim().toUpperCase(), out = $("vin-msg");
    // 리콜 통지서의 NHTSA 번호(24V-744, 24V744, 24V744000)면 그 리콜 페이지로 바로 간다
    var camp = /^(\d{2}[VETC])-?(\d{3})(\d{3})?$/.exec(vin.replace(/\s+/g, ""));
    if (camp) {
      var id = (camp[1] + camp[2] + (camp[3] || "000")).toLowerCase();
      out.textContent = "Looking up recall " + id.toUpperCase() + "…";
      fetch("/recall/" + id + "/", { method: "HEAD" }).then(function (r) {
        if (r.ok) { location.href = "/recall/" + id + "/"; return; }
        out.innerHTML = ""; out.append("We don't have recall " + id.toUpperCase() + " — we cover 2018 and newer passenger vehicles from 32 makes. ");
        var a = document.createElement("a"); a.href = "https://www.nhtsa.gov/recalls?nhtsaId=" + id.toUpperCase(); a.rel = "nofollow"; a.textContent = "Look it up at NHTSA"; out.append(a, ".");
      }).catch(function () { out.textContent = "Couldn't look that up right now."; });
      return;
    }
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) { out.textContent = "Enter a 17-character VIN (never contains I, O or Q) or an NHTSA recall number such as 24V744."; return; }
    out.textContent = "Decoding…";
    fetch("https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/" + vin + "?format=json")
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var v = (j.Results || [])[0] || {}, mk = (v.Make || "").toUpperCase(), mo = (v.Model || "").toUpperCase(), y = v.ModelYear || "";
        if (!mk || !idx) throw 0;
        var name = [y, v.Make, v.Model].join(" ").trim();
        if (!idx[mk]) { out.textContent = "That VIN decodes to a " + name + ". We don't track that make — use the official NHTSA lookup below."; return; }
        var key = Object.keys(idx[mk].m).filter(function (k) { return k === mo; })[0] ||
                  Object.keys(idx[mk].m).filter(function (k) { return k.indexOf(mo) === 0 || mo.indexOf(k) === 0; })[0];
        if (!key) { out.innerHTML = ""; out.append("That VIN decodes to a " + name + ". We have no recalls on file for that model — "); var a = document.createElement("a"); a.href = "/" + idx[mk].s + "/"; a.textContent = "see all " + idx[mk].t + " models"; out.append(a, "."); return; }
        go(mk, key, y);
      })
      .catch(function () { out.textContent = "Couldn't decode that VIN right now. Use the official NHTSA lookup below."; });
  });
})();
