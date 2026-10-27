(function() {
  console.log('[MapsScraper] Network interceptor active (100% Complete Data Mode)');

  function handleData(url, data) {
    if (!data) return;
    try {
      const urlStr = String(url || '');
      const textData = typeof data === 'string' ? data : JSON.stringify(data);
      if (textData.length > 80) {
        // Catch any Google Maps RPC search response
        if (textData.includes(")]}'") || textData.includes("/*-private-token-*/") || urlStr.includes('/search') || urlStr.includes('/rpc/') || urlStr.includes('tbm=map') || textData.includes('ChIJ')) {
          window.dispatchEvent(new CustomEvent('GOOGLE_SEARCH_API_gtbakz', {
            detail: { url: urlStr, data: textData }
          }));

          // Direct live stream to bemailsender backend if launched with session
          try {
            const urlParams = new URLSearchParams(window.location.search);
            const sid = urlParams.get('bemailsender_session') || localStorage.getItem('bemailsender_session_id');
            if (sid) {
              origFetch('http://localhost:8000/api/gmaps/collect/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: sid, raw: textData, enrich: false })
              }).catch(() => {});
            }
          } catch(e) {}
        }
      }
    } catch (err) {}
  }

  // 1. Hook window.fetch
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await origFetch.apply(this, args);
    try {
      const targetUrl = (args[0] && args[0].url) || args[0] || '';
      const clone = response.clone();
      clone.text().then(text => {
        handleData(targetUrl, text);
      }).catch(() => {});
    } catch (e) {}
    return response;
  };

  // 2. Hook XMLHttpRequest via msnetah and prototype
  try {
    if (window.msnetah && typeof window.msnetah.hook === 'function') {
      window.msnetah.hook({
        onreadystatechange: function(xhr) {
          if (xhr && xhr.readyState === 4 && xhr.status === 200) {
            handleData(xhr.responseURL, xhr.response || xhr.responseText);
          }
          return false;
        },
        onload: function(xhr) {
          if (xhr && xhr.status === 200) {
            handleData(xhr.responseURL, xhr.response || xhr.responseText);
          }
          return false;
        },
        open: function() { return false; }
      });
    }
  } catch (err) {}

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._msUrl = url;
    return origOpen.apply(this, arguments);
  };

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
      if (this.status === 200) {
        handleData(this.responseURL || this._msUrl, this.response || this.responseText);
      }
    });
    return origSend.apply(this, arguments);
  };
})();
