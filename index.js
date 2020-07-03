const { app, Tray, Menu, BrowserWindow, shell, globalShortcut, Notification } = require('electron');
const fs = require('fs').promises;
const constants = require('fs').constants;
const path = require('path');
const os = require('os');
const chokidar = require('chokidar');
const debug = require('debug');
const log = debug('npm-switch');

const icon = path.join(__dirname, 'npm_icon.png');
const configDir = path.resolve(os.homedir(), '.npm_switch');
const npmrcDir = path.resolve(configDir, '.npmrc');
const configFile = path.join(configDir, 'config.json');
const defaultNpmrc = path.resolve(os.homedir(), '.npmrc');

let tray;

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
	config.files = files;
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
			const accelerator = `CommandOrControl+Shift+${i + 1}`;
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
			globalShortcut.register(accelerator, action);
			return {
				label,
				accelerator,
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

app.on('ready', async () => {
	log('app ready');
	try {
		await ensureConfig();
		win = new BrowserWindow({ show: false });
		tray = new Tray(icon);
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

