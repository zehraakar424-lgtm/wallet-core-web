(function () {
  if (window.__xendraDappInject) return;
  window.__xendraDappInject = true;

  var tag = document.currentScript;
  var parentOrigin = tag && tag.getAttribute("data-parent");
  if (!parentOrigin) {
    try {
      parentOrigin = new URL(document.referrer).origin;
    } catch (e) {
      parentOrigin = "*";
    }
  }

  var pending = Object.create(null);

  function rpc(chain, method, params) {
    return new Promise(function (resolve, reject) {
      var id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      pending[id] = { resolve: resolve, reject: reject };
      window.parent.postMessage(
        { source: "xendra-dapp", id: id, chain: chain, method: method, params: params || [] },
        parentOrigin === "*" ? "*" : parentOrigin
      );
    });
  }

  window.addEventListener("message", function (ev) {
    var d = ev.data;
    if (!d || d.source !== "xendra-parent" || !d.id) return;
    var p = pending[d.id];
    if (!p) return;
    delete pending[d.id];
    if (d.error) p.reject(Object.assign(new Error(d.error.message || "RPC error"), { code: d.error.code }));
    else p.resolve(d.result);
  });

  var eth = {
    isXendra: true,
    isMetaMask: true,
    request: function (arg) {
      var method = typeof arg === "string" ? arg : arg.method;
      var params = typeof arg === "string" ? [] : arg.params || [];
      return rpc("evm", method, params);
    },
    on: function () {},
    removeListener: function () {},
  };
  window.ethereum = eth;

  var solConn = { publicKey: null };
  window.solana = {
    isXendra: true,
    isPhantom: true,
    publicKey: null,
    connect: function () {
      return rpc("solana", "connect", []).then(function (r) {
        solConn.publicKey = { toString: function () { return r; }, toBase58: function () { return r; } };
        window.solana.publicKey = solConn.publicKey;
        return { publicKey: solConn.publicKey };
      });
    },
    disconnect: function () {
      solConn.publicKey = null;
      window.solana.publicKey = null;
      return Promise.resolve();
    },
    signTransaction: function (tx) {
      return rpc("solana", "signTransaction", [tx.serialize({ requireAllSignatures: false, verifySignatures: false })]);
    },
    signMessage: function (msg, enc) {
      var bytes =
        msg instanceof Uint8Array
          ? Array.from(msg)
          : Array.from(new TextEncoder().encode(String(msg)));
      return rpc("solana", "signMessage", [bytes, enc || "utf8"]).then(function (sigArr) {
        return { signature: Uint8Array.from(sigArr) };
      });
    },
  };

  window.dispatchEvent(new Event("ethereum#initialized"));
})();
