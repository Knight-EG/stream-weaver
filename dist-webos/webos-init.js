// Auto-detect webOS and set TV mode
if (!window.location.search.includes('tv=1') && !window.location.search.includes('mode=tv')) {
  var sep = window.location.search ? '&' : '?';
  window.location.replace(window.location.pathname + window.location.search + sep + 'tv=1' + window.location.hash);
}
