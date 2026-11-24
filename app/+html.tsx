import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const ICON_FONT_CSS = `
@font-face {
  font-family: "material";
  src: url("/fonts/MaterialIcons.ttf") format("truetype");
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: "MaterialIcons";
  src: url("/fonts/MaterialIcons.ttf") format("truetype");
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
`;

const SW_REGISTER_SCRIPT = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      reg.update().catch(function () {});
    }).catch(function () {});
  });
}
`;

export default function Root({ children }: PropsWithChildren) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>Unity Ledger</title>
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <meta name="theme-color" content="#111827" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Unity Ledger" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link
          rel="preload"
          href="/fonts/MaterialIcons.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <style id="expo-generated-fonts" dangerouslySetInnerHTML={{ __html: ICON_FONT_CSS }} />
        <ScrollViewStyleReset />
        {headNodes}
        <script dangerouslySetInnerHTML={{ __html: SW_REGISTER_SCRIPT }} />
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
