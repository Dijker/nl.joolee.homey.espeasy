const Homey = require('homey');

module.exports = class UnitDevice extends Homey.Device {
	// Homey function
	onInit() {
		this.setUnavailable("Initializing");
		this.unit = Homey.app.units.getUnit(
			this.getData().mac,
			this.getSetting('host'),
			this.getSetting('port'));
		this.unit.on('newhostname', this.updateHostname.bind(this))
		this.unit.addDriver(this);

		this.unit.updateJSON();

		// Permanent binds for functions that get passed around :)
		this.onRawMessage = this.onRawMessage.bind(this);
		this.onJSONUpdate = this.onJSONUpdate.bind(this);
		this.onUnitUpdate = this.onUnitUpdate.bind(this);
		this.unit.on('rawMessage', this.onRawMessage);
		this.unit.on('jsonUpdate', this.onJSONUpdate);
		this.unit.on('settingsUpdate', this.onUnitUpdate);

		this.unit.setPollInterval(this.getSetting('pollInterval'));
		this.log('Init:', this.getName());
	}

	onUnitUpdate(unit, newSettings) {
		this.updateHostname(unit, newSettings.host, newSettings.port);
		this.setSettings({
			"idx": newSettings.idx.toString()
		}).catch(error => this.log('Settings update failed', error, newSettings.idx));
	}


	updateHostname(unit, hostname, port) {
		if (hostname != this.getSetting('host') || port != this.getSetting('port')) {
			this.log(`Changing hostname to ${hostname}`);
			this.setSettings({
				"host": hostname,
				"port": port
			});
		}
	}

	onSettings(oldSettingsObj, newSettingsObj, changedKeysArr, callback) {
		callback();
		if (changedKeysArr.includes('host') || changedKeysArr.includes('port')) {
			this.unit.updateHost(newSettingsObj.host, newSettingsObj.port);
		}

		if (changedKeysArr.includes('pollInterval')) {
			this.unit.setPollInterval(newSettingsObj.pollInterval);
		}
	}

	// Homey function
	onDeleted() {
		this.log("Device deleted", this.unit.mac, this.unit.name);
		this.unit.removeListener('rawMessage', this.onRawMessage);
		this.unit.removeListener('jsonUpdate', this.onJSONUpdate);
		clearInterval(this.poller);
		this.unit.removeDriver();
	}

	onRawMessage() {
		this.setCapabilityValue('heartbeat', this.unit.lastEvent.toLocaleString());
	}

	onJSONUpdate(unit, json) {
		if (!this.getAvailable()) {
			this.log('Initialized with json data from ESP unit');
			this.setAvailable();
		}

		unit.driver.setCapabilityValue('custom_load', json.System['Load'])
			.catch(this.log);
		unit.driver.setCapabilityValue('custom_ram', json.System['Free RAM'])
			.catch(this.log);
		unit.driver.setCapabilityValue('custom_heap', json.System['Heap Max Free Block'])
			.catch(this.log);
		unit.driver.setCapabilityValue('custom_uptime', json.System['Uptime'] + " " + Homey.__('minutes'))
			.catch(this.log);
		unit.driver.setCapabilityValue('custom_heartbeat', unit.lastEvent.toLocaleString())
			.catch(this.log);
	}
}