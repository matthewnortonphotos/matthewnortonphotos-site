(() => {
  const icon = document.getElementById('siteFavicon');
  const theme = window.matchMedia('(prefers-color-scheme: dark)');
  const update = () => { icon.href = `assets/favicons/${theme.matches ? 'dark' : 'light'}-32.png`; };
  update();
  if (theme.addEventListener) theme.addEventListener('change', update);
  else theme.addListener(update);
})();
