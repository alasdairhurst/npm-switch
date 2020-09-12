# NPM Switch

## Building NPM Switch for your platform

```
git clone https://github.com/alasdairhurst/npm-switch
cd npm-switch
npm install
npm run build
```

This will output a directory called npm-switch-<platform>-<architecture> which contains all the files needed for running.

Alternatively you can start/test using

```
npm install
npm start
```

## Generate icons
- create dist/icons
- npm run build:icons
- to update, copy the following icons:
/dist/icons/colour/16x16.png => /src/icons/icon_tray.png
/dist/icons/template/16x16.png => /src/icons/icon_trayTemplate.png
/dist/icons/template/32x32.png => /src/icons/icon_trayTemplate@2x.png
