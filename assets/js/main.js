/* Legatto: motor das interações.
   Cada página carrega assets/js/pages/<pagina>.js com os componentes dela (modelo + lógica).
   Este arquivo renderiza os componentes no navegador, liga os eventos (cliques, campos)
   e atualiza só o que mudou quando o estado muda (carrossel, abas, filtros, carrinho, formulários, menu). */
(function () {
  'use strict';
  var DC = {};
  var PAGES = {
    'Main.dc.html': 'index.html', 'Produtos.dc.html': 'produtos.html', 'Produto.dc.html': 'produto.html', 'ProdutoVariacao.dc.html': 'produto-chuveiro.html', 'ProdutoDucha.dc.html': 'produto-ducha.html', 'ProdutoPendente.dc.html': 'produto-pendente.html',
    'QuemSomos.dc.html': 'quem-somos.html', 'Cases.dc.html': 'cases.html', 'Blog.dc.html': 'blog.html',
    'BlogPost.dc.html': 'blog-artigo.html', 'Contato.dc.html': 'contato.html',
    'VendaEmpresas.dc.html': 'venda-para-empresas.html', 'GrupoVip.dc.html': 'grupo-vip.html',
    'GrupoVipObrigado.dc.html': 'grupo-vip-obrigado.html', 'Carrinho.dc.html': 'carrinho.html',
    'Login.dc.html': 'login.html', 'Cadastro.dc.html': 'criar-conta.html', 'RecuperarSenha.dc.html': 'recuperar-senha.html',
    'MinhaConta.dc.html': 'minha-conta.html', 'Pedidos.dc.html': 'meus-pedidos.html', 'PedidoDetalhe.dc.html': 'pedido.html',
    'MeusDados.dc.html': 'meus-dados.html', 'Enderecos.dc.html': 'enderecos.html'
  };
  var BOOL = { checked: 1, disabled: 1, selected: 1, required: 1, readonly: 1 };
  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var WHOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;

  function lookup(scope, expr) {
    expr = expr.trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    if (/^'.*'$/.test(expr)) return expr.slice(1, -1);
    var cur = scope, ks = expr.split('.');
    for (var i = 0; i < ks.length; i++) { if (cur == null) return undefined; cur = cur[ks[i]]; }
    return cur;
  }
  function interp(str, scope) {
    return str.replace(HOLE, function (_, e) { var v = lookup(scope, e); return v == null ? '' : String(v); });
  }
  function fixUrl(n, v) {
    if (n === 'href') {
      var m = v.match(/^\/?([A-Za-z0-9_]+\.dc\.html)(#.*)?$/);
      if (m && PAGES[m[1]]) v = PAGES[m[1]] + (m[2] || '');
      if (v === '#') v = '#conteudo';
    }
    return v.replace(/\/_blob\/([0-9a-f]{32})/g, function (s, id) { return DC.assets[id] || s; });
  }

  /* componentes */
  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (p) {
    var n = typeof p === 'function' ? p(this.state, this.props) : p;
    var s = {}, k;
    for (k in this.state) s[k] = this.state[k];
    for (k in n) s[k] = n[k];
    this.state = s;
    schedule();
  };
  DCLogic.prototype.forceUpdate = function () { schedule(); };

  var defs = {}, instances = {};
  function getDef(file) {
    if (defs[file]) return defs[file];
    var d = DC.defs[file];
    var t = document.createElement('template');
    t.innerHTML = d.tpl;
    defs[file] = { root: t.content, Component: d.code(DCLogic) };
    return defs[file];
  }

  function renderComponent(file, props, key, out) {
    var def = getDef(file);
    var inst = instances[key];
    if (!inst) { inst = instances[key] = new def.Component(props); inst.props = props; }
    else inst.props = props;
    var vals = inst.renderVals() || {};
    var ctx = { key: key, n: 0 };
    renderNodes(def.root.childNodes, vals, out, ctx);
  }
  function renderNodes(nodes, scope, out, ctx) {
    for (var i = 0; i < nodes.length; i++) renderNode(nodes[i], scope, out, ctx);
  }
  function extend(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

  function renderNode(node, scope, out, ctx) {
    if (node.nodeType === 3) { out.appendChild(document.createTextNode(interp(node.nodeValue, scope))); return; }
    if (node.nodeType !== 1) return;
    var svgNs = 'http://www.w3.org/2000/svg';
    var inSvg = node.namespaceURI === svgNs;
    var tag = inSvg ? node.localName : node.tagName.toLowerCase();
    if (tag === 'helmet' || tag === 'script') return;
    if (tag === 'sc-for') {
      var list = lookup(scope, node.getAttribute('list').replace(/[{}]/g, '')) || [];
      var as = node.getAttribute('as');
      for (var i = 0; i < list.length; i++) {
        var sc = extend(scope, {}); sc[as] = list[i]; sc.$index = i;
        renderNodes(node.childNodes, sc, out, ctx);
      }
      return;
    }
    if (tag === 'sc-if') {
      if (lookup(scope, node.getAttribute('value').replace(/[{}]/g, ''))) renderNodes(node.childNodes, scope, out, ctx);
      return;
    }
    if (tag === 'dc-import') {
      var name = node.getAttribute('name'), props = {};
      for (var a = 0; a < node.attributes.length; a++) {
        var at = node.attributes[a];
        if (at.name === 'name' || at.name.indexOf('hint-') === 0) continue;
        var pk = at.name.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
        var w = at.value.match(WHOLE);
        props[pk] = w ? lookup(scope, w[1]) : interp(at.value, scope);
      }
      renderComponent(name + '.dc.html', props, ctx.key + '/' + name + '#' + (ctx.n++), out);
      return;
    }
    var el = inSvg ? document.createElementNS(svgNs, tag) : document.createElement(tag);
    var handlers = null;
    for (var j = 0; j < node.attributes.length; j++) {
      var att = node.attributes[j], n = att.name;
      if (n.indexOf('hint-') === 0) continue;
      var wm = att.value.match(WHOLE);
      var v = wm ? lookup(scope, wm[1]) : interp(att.value, scope);
      if (/^on[a-z]/.test(n)) {
        if (typeof v === 'function') {
          var ev = n.slice(2);
          if (ev === 'change' && (tag === 'textarea' || (tag === 'input' && !/^(checkbox|radio|file)$/i.test(node.getAttribute('type') || '')))) ev = 'input';
          (handlers || (handlers = {}))[ev] = v;
        }
        continue;
      }
      if (typeof v === 'function') continue;
      if (BOOL[n]) { if (v === true || v === 'true' || v === '') el.setAttribute(n, ''); continue; }
      if (v == null) continue;
      el.setAttribute(n, fixUrl(n, String(v)));
    }
    if (handlers) el.__h = handlers;
    if (tag === 'select' && node.hasAttribute('value')) {
      var sel = interp(node.getAttribute('value'), scope);
      renderNodes(node.childNodes, scope, el, ctx);
      var opts = el.querySelectorAll('option');
      for (var o = 0; o < opts.length; o++) {
        var ov = opts[o].hasAttribute('value') ? opts[o].getAttribute('value') : opts[o].textContent;
        if (ov === sel) opts[o].setAttribute('selected', ''); else opts[o].removeAttribute('selected');
      }
      el.removeAttribute('value');
      out.appendChild(el);
      return;
    }
    renderNodes(node.childNodes, scope, el, ctx);
    out.appendChild(el);
  }

  /* eventos */
  function bind(el) {
    if (!el.__h) return;
    el.__b = el.__b || {};
    for (var t in el.__h) {
      if (el.__b[t]) continue;
      el.__b[t] = 1;
      (function (type) {
        el.addEventListener(type, function (e) { var f = el.__h && el.__h[type]; if (f) f(e); });
      })(t);
    }
  }
  function bindTree(root) {
    if (root.nodeType !== 1) return;
    bind(root);
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) bind(all[i]);
  }

  /* atualização do DOM: mantém os elementos existentes e muda só o necessário */
  function syncAttrs(a, b) {
    var i, n;
    for (i = a.attributes.length - 1; i >= 0; i--) {
      n = a.attributes[i].name;
      if (!b.hasAttribute(n)) {
        a.removeAttribute(n);
        if (n === 'checked') a.checked = false;
        if (n === 'selected') a.selected = false;
      }
    }
    for (i = 0; i < b.attributes.length; i++) {
      n = b.attributes[i].name;
      var v = b.attributes[i].value;
      if (a.getAttribute(n) === v) continue;
      var had = a.hasAttribute(n);
      a.setAttribute(n, v);
      if (n === 'value' && 'value' in a && a.value !== v) a.value = v;
      if (n === 'checked' && !had) a.checked = true;
      if (n === 'selected' && !had) a.selected = true;
    }
    a.__h = b.__h;
    bind(a);
  }
  function morphChildren(a, b) {
    var bl = Array.prototype.slice.call(b.childNodes);
    for (var i = 0; i < bl.length; i++) {
      var nb = bl[i], na = a.childNodes[i];
      if (!na) { a.appendChild(nb); bindTree(nb); continue; }
      if (na.nodeType !== nb.nodeType || (na.nodeType === 1 && na.tagName !== nb.tagName)) {
        a.replaceChild(nb, na); bindTree(nb); continue;
      }
      if (na.nodeType === 3) { if (na.nodeValue !== nb.nodeValue) na.nodeValue = nb.nodeValue; continue; }
      if (na.nodeType === 1) { syncAttrs(na, nb); morphChildren(na, nb); }
      else a.replaceChild(nb, na);
    }
    while (a.childNodes.length > bl.length) a.removeChild(a.lastChild);
  }

  var app, rootFile, queued = false;
  function render() {
    queued = false;
    var frag = document.createElement('div');
    renderComponent(rootFile, {}, 'root', frag);
    morphChildren(app, frag);
    document.dispatchEvent(new CustomEvent('dc:render'));
  }
  function schedule() {
    if (queued) return;
    queued = true;
    (window.queueMicrotask || function (f) { Promise.resolve().then(f); })(render);
  }

  function start() {
    DC = window.DC || {};
    app = document.getElementById('dc-app');
    if (!app || !DC.defs || !DC.root) return;
    rootFile = DC.root;
    render();
    extras();
  }

  /* extras fora do editor: carrossel automático e tecla Esc no menu mobile */
  function extras() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var car = app.querySelector('[aria-roledescription="carrossel"]');
    if (car && !reduce) {
      var paused = false;
      car.addEventListener('mouseenter', function () { paused = true; });
      car.addEventListener('mouseleave', function () { paused = false; });
      car.addEventListener('focusin', function () { paused = true; });
      car.addEventListener('focusout', function () { paused = false; });
      setInterval(function () {
        if (paused || document.hidden) return;
        var next = car.querySelector('button[aria-label="Próxima oferta"]');
        if (next) next.click();
      }, 7000);
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var b = app.querySelector('.hd button.mob[aria-expanded="true"]');
      if (b) { b.click(); b.focus(); }
    });
    document.addEventListener('dc:render', function () {
      var open = app.querySelector('.hd button.mob[aria-expanded="true"]');
      document.body.style.overflow = open ? 'hidden' : '';
    });
  }

  /* os scripts com defer rodam antes do DOMContentLoaded, então os componentes da página já estão carregados */
  if (document.readyState === 'complete') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
