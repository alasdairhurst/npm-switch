const { app, Tray, Menu, BrowserWindow, shell, globalShortcut, Notification, nativeTheme } = require('electron');
const fs = require('fs').promises;
const constants = require('fs').constants;
const path = require('path');
const chokidar = require('chokidar');
const debug = require('debug');
const log = debug('npm-switch');

console.log(app.getAppPath())

const icon_tray_template = path.join(app.getAppPath(), 'src', 'icons', 'icon-trayTemplate.png');
const icon_tray          = path.join(app.getAppPath(), 'src', 'icons', 'icon-tray.png');
const icon               = path.join(app.getAppPath(), 'src', 'icons', 'icon-colour-lg.png');
const configDir    = path.join(app.getPath('home'), '.npm_switch');
const defaultNpmrc = path.join(app.getPath('home'), '.npmrc');
const npmrcDir   = path.join(configDir, '.npmrc');
const configFile = path.join(configDir, 'config.json');

let tray;

function getIcon() {
	// if switching based on theme: nativeTheme.shouldUseDarkColors

	if (process.platform === 'darwin') {
		return icon_tray_template;
	} else if (process.platform === 'win32') {
	 return icon_tray;
	} else {
		return icon_tray;
	}
}

// look into for a lighter alternative
// https://github.com/zaaack/node-systray
// https://github.com/mikaelbr/node-notifier

// https://nwjs.readthedocs.io/en/latest/References/Tray/

async function loadConfig() {
	let config;
	try {
		const buffer = await fs.readFile(path.join(configDir, 'config.json'));
		config = JSON.parse(buffer.toString());
	} catch {
		// no config
		config = {};
	}
	const files = await fs.readdir(npmrcDir);
	config.files = files.filter(file => file !== '.DS_Store');
	return config;
}

async function getContextMenu(config) {
	globalShortcut.unregisterAll();
	const none = [];
	if (!config.selected) {
		none.push({
			enabled: false,
			label: '.npmrc is unmanaged',
			type: 'radio',
			checked: true
		});
	}
	const contextMenu = Menu.buildFromTemplate([
		...none,
		...config.files.map((label, i) => {
			const action = async () => {
				if (config.selected === label) {
					return;
				}
				// select item;
				// pop up system notification "switched npm to..."
				await copyNpmrc(label);
				config.selected = label;
				await updateConfig(config);
				const notification = new Notification({
					title: 'NPM Switcher',
					icon,
					body: 'Switched .npmrc to ' + label,
				});
				notification.show();
			}
			return {
				label,
				type: 'radio',
				click: action,
				checked: config.selected === label
			}
		}),
		{
			type: 'separator'
		},
		{
			label: 'Configure...',
			click: () => {
				shell.openPath(npmrcDir);
			}
		},
		{
			label: 'Close NPM switcher',
			type: 'normal',
			role: 'quit',
			click: () => {
				app.quit();
			}
		}
	]);
	return contextMenu;
}

async function loadContextMenu(tray) {
	const config = await loadConfig();
	const contextMenu = await getContextMenu(config);
	tray.setContextMenu(contextMenu);
	log('config and menu loaded');
	return contextMenu;
}

async function ensureDir(dir) {
	try {
		log('access ensureDir', dir);
		await fs.access(dir, constants.F_OK | constants.W_OK);
	} catch (err) {
		await fs.mkdir(dir);
	}
}

async function ensureFile(file, defaultData) {
	try {
		log('access ensureFile', file);
		await fs.access(file, constants.F_OK | constants.W_OK);
	} catch (err) {
		await fs.writeFile(file, defaultData);
	}
}

async function backupExisting() {
	const dir = path.resolve(configDir, '.npmrc.bak');
	log('backing up existing .npmrc to', dir);
	await fs.copyFile(defaultNpmrc, dir);
}

async function ensureConfig() {
	await ensureDir(configDir);
	await ensureFile(configFile, JSON.stringify({
		target: defaultNpmrc
	}, null, '\t'));
	await ensureDir(npmrcDir);
}

async function updateConfig({ selected, target }) {
	return fs.writeFile(configFile, JSON.stringify({
		selected,
		target
	}, null, '\t'));
}

async function copyNpmrc(source) {
	try {
		log('checking access permissions', defaultNpmrc);
		await fs.access(defaultNpmrc, constants.F_OK | constants.W_OK);
		const stats = await fs.lstat(defaultNpmrc);
		if (!stats.isSymbolicLink()) {
			log('existing .npmrc is unmanaged, backing up...');
			await backupExisting();
		}
		log('removing existing file');
		await fs.unlink(defaultNpmrc);
	} catch (err) {
		console.log(err);
	}
	const newSource = path.resolve(npmrcDir, source);
	log('creating link to', newSource);
	await fs.symlink(newSource, defaultNpmrc, 'file');
}

app.dock && app.dock.hide();



app.on('ready', async () => {
	log('app ready');
	try {
		await ensureConfig();
		win = new BrowserWindow({
			show: false,
			skipTaskbar: true
		});
		tray = new Tray(getIcon());
		await loadContextMenu(tray);
		log('watching changes in', npmrcDir);
		const confWatcher = chokidar.watch(configFile);
		confWatcher.on('ready', () => {
			confWatcher.on('change', async (event, path) => {
				try {
					log('change detected in', configFile, event, path);
					await loadContextMenu(tray);
				} catch (err) {
					console.log(err);
					app.quit(1);
				}
			});
		});

		nativeTheme.on('updated', () => {
			tray.setImage(getIcon());
		});

		// TODO: add info to config file and only watch that file
		const watcher = chokidar.watch(npmrcDir);
		watcher.on('ready', () => {
			watcher.on('all', async (event, path) => {
				if (event === 'change') {
					return;
				}
				try {
					log('change detected in', npmrcDir, event, path);
					await loadContextMenu(tray);
				} catch (err) {
					console.log(err);
					app.quit(1);
				}
			});
		});
	} catch (err) {
		console.log(err);
		app.quit(1);
	}
});

