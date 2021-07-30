require('./Base');

const colorsys = require('colorsys');
const inherits = require('util').inherits;
const miio = require('miio');


var Accessory, PlatformAccessory, Service, Characteristic, UUIDGen;

MiSmartBulb = function(platform, config) {
    this.init(platform, config);
    
    Accessory = platform.Accessory;
    PlatformAccessory = platform.PlatformAccessory;
    Service = platform.Service;
    Characteristic = platform.Characteristic;
    UUIDGen = platform.UUIDGen;
    
    this.device = new miio.Device({
        address: this.config['ip'],
        token: this.config['token']
    });
    
    this.accessories = {};
    if(!this.config['lightDisable'] && this.config['lightName'] && this.config['lightName'] != "") {
        this.accessories['lightAccessory'] = new MiSmartLightBulb(this);
    }
    var accessoriesArr = this.obj2array(this.accessories);
    
    this.platform.log.debug("[MiLightPlatform][DEBUG]Initializing " + this.config["type"] + " device: " + this.config["ip"] + ", accessories size: " + accessoriesArr.length);
    
    return accessoriesArr;
}
inherits(MiSmartBulb, Base);


MiSmartLightBulb = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['lightName'];
	this.isColor =dThis.config['isColor'];
    this.platform = dThis.platform;
}

MiSmartLightBulb.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "Smart Bulb")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);
    
    var lightService = new Service.Lightbulb(this.name);
    lightService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getPower.bind(this))
        .on('set', this.setPower.bind(this));
    lightService
        .addCharacteristic(Characteristic.Brightness)
        .on('get', this.getBrightness.bind(this))
        .on('set', this.setBrightness.bind(this));
    if(this.isColor){
		lightService
			.addCharacteristic(Characteristic.Hue)
			.on('get', this.getColor.bind(this))
			.on('set', this.setColor.bind(this));
		lightService
			.addCharacteristic(Characteristic.Saturation)
			.on('get', this.getSaturation.bind(this))
			.on('set', this.setSaturation.bind(this));
		lightService
        .addCharacteristic(Characteristic.ColorTemperature)
        .setProps({
            minValue: 1700,
            maxValue: 6500,
            minStep: 100
        })
        .on('get', this.getColorTemperature.bind(this))
        .on('set', this.setColorTemperature.bind(this));
	}
    services.push(lightService);

    return services;
}

MiSmartLightBulb.prototype.getPower = function(callback) {
    var that = this;
    this.device.call("get_prop", ["power"]).then(result => {
        that.platform.log.debug("[MiLightPlatform][DEBUG]MiSmartLightBulb - Light - getPower: " + result);
        callback(null, result[0] === 'on' ? true : false);
    }).catch(function(err) {
        that.platform.log.error("[MiLightPlatform][ERROR]MiSmartLightBulb - Light - getPower Error: " + err);
        callback(err);
    });
}

MiSmartLightBulb.prototype.setPower = function(value, callback) {
    var that = this;
    that.device.call("set_power", [value ? "on" : "off"]).then(result => {
        that.platform.log.debug("[MiLightPlatform][DEBUG]MiSmartLightBulb - Light - setPower Result: " + result);
        if(result[0] === "ok") {
            callback(null);
        } else {
            callback(new Error(result[0]));
        }
    }).catch(function(err) {
        that.platform.log.error("[MiLightPlatform][ERROR]MiSmartLightBulb - Light - setPower Error: " + err);
        callback(err);
    });
}

MiSmartLightBulb.prototype.getBrightness = function(callback) {
    var that = this;
    this.device.call("get_prop", ["bright"]).then(result => {
        that.platform.log.debug("[MiLightPlatform][DEBUG]MiSmartLightBulb - Light - getBrightness: " + result);
        callback(null, result[0]);
    }).catch(function(err) {
        that.platform.log.error("[MiLightPlatform][ERROR]MiSmartLightBulb - Light - getBrightness Error: " + err);
        callback(err);
    });
}

MiSmartLightBulb.prototype.setBrightness = function(value, callback) {
    var that = this;
    if(value > 0) {
        this.device.call("set_bright", [value]).then(result => {
            that.platform.log.debug("[MiLightPlatform][DEBUG]MiSmartLightBulb - Light - setBrightness Result: " + result);
            if(result[0] === "ok") {
                callback(null);
            } else {
                callback(new Error(result[0]));
            }
        }).catch(function(err) {
            that.platform.log.error("[MiLightPlatform][ERROR]MiSmartLightBulb - Light - setBrightness Error: " + err);
            callback(err);
        });
    } else {
        callback(null);
    }
}

MiSmartLightBulb.prototype.getColor = function(callback) {
    var that = this;
	this.device.call("get_prop", ["rgb"]).then(result => {	
	const red = (result[0] >> 16) & 0xFF;
		const green = (result[0] >> 8) & 0xFF;
		const blue = result[0] & 0xFF;
		const hsv = colorsys.rgb_to_hsv({ r: red, g: green, b: blue });
		that.hsv = hsv;
        that.platform.log.debug("[MiLightPlatform][DEBUG]MiSmartLightBulb - Light - getColor: " + hsv);
        callback(null, hsv.h);
    }).catch(function(err) {
        that.platform.log.error("[MiLightPlatform][ERROR]MiSmartLightBulb - Light - getColor Error: " + err);
        callback(err);
    });
}

MiSmartLightBulb.prototype.setColor = function(value, callback) {
    var that = this;
	if(!that.hsv){
		callback();
		return;
	}else{
		const newhsv = {h: value, s: that.hsv.s, v: that.hsv.v};
		that.hsv = newhsv;
		const newrgb = colorsys.hsv_to_rgb(newhsv);
		//const rgbcode = (newrgb.r).toString(16).padStart(2, '0')   +  (newrgb.g).toString(16).padStart(2, '0') +  (newrgb.b).toString(16).padStart(2, '0');
		const DEFAULT_EFFECT = 'sudden';
		const DEFAULT_DURATION = 500;
		const rgbcode = newrgb.r * 65536 + newrgb.g * 256 + newrgb.b;
		const packet = Array.isArray(rgbcode) ? rgbcode : [ rgbcode ];
		packet.push(DEFAULT_EFFECT);
		packet.push(DEFAULT_DURATION);
		this.device.call("set_rgb",packet).then(result => {
			that.platform.log.debug("[MiLightPlatform][DEBUG]MiSmartLightBulb - Light - setColor" + value + " Result: " + result);
			if(result[0] === "ok") {
				callback(null);
			} else {
				callback(new Error(result[0]));
			}
		}).catch(function(err) {
			that.platform.log.error("[MiLightPlatform][ERROR]MiSmartLightBulb - Light - setColor Error: " + err);
			callback(err);
		});
	}
}

MiSmartLightBulb.prototype.getSaturation = function(callback) {
    var that = this;
    this.device.call("get_prop", ["rgb"]).then(result => {
		const red = (result[0] >> 16) & 0xFF;
		const green = (result[0] >> 8) & 0xFF;
		const blue = result[0] & 0xFF;
		const hsv = colorsys.rgb_to_hsv({ r: red, g: green, b: blue });
		that.hsv = hsv;
        that.platform.log.debug("[MiLightPlatform][DEBUG]MiSmartLightBulb - Light - getSaturation: " + hsv);
        callback(null, hsv.s);
    }).catch(function(err) {
        that.platform.log.error("[MiLightPlatform][ERROR]MiSmartLightBulb - Light - getSaturation Error: " + err);
        callback(err);
    });
}

MiSmartLightBulb.prototype.setSaturation = function(value, callback) {
    var that = this;
	if(!that.hsv){
		callback();
		return;
	}else{
		const newhsv = {h: that.hsv.h, s: value, v: that.hsv.v};
		that.hsv = newhsv;
		const newrgb = colorsys.hsv_to_rgb(newhsv);
		//const rgbcode = (newrgb.r).toString(16).padStart(2, '0')   +  (newrgb.g).toString(16).padStart(2, '0') +  (newrgb.b).toString(16).padStart(2, '0');
		const DEFAULT_EFFECT = 'sudden';
		const DEFAULT_DURATION = 500;
		const rgbcode = newrgb.r * 65536 + newrgb.g * 256 + newrgb.b;
		const packet = Array.isArray(rgbcode) ? rgbcode : [ rgbcode ];
		packet.push(DEFAULT_EFFECT);
		packet.push(DEFAULT_DURATION);
		this.device.call("set_rgb", packet).then(result => {
			that.platform.log.debug("[MiLightPlatform][DEBUG]MiSmartLightBulb - Light - setSaturation" + value + " Result: " + result);
			if(result[0] === "ok") {
				callback(null);
			} else {
				callback(new Error(result[0]));
			}
		}).catch(function(err) {
			that.platform.log.error("[MiLightPlatform][ERROR]MiSmartLightBulb - Light - setSaturation Error: " + err);
			callback(err);
		});
	}
}

MiSmartLightBulb.prototype.getColorTemperature = function(callback) {
    var that = this;
    this.device.call("get_prop", ["ct"]).then(result => {
        that.platform.log.debug("[MiLightPlatform][DEBUG]MiSmartLightBulb - Light - getColorTemperature: " + result);
        callback(null, result[0]);
    }).catch(function(err) {
        that.platform.log.error("[MiLightPlatform][ERROR]MiSmartLightBulb - Light - getColorTemperature Error: " + err);
        callback(err);
    });
}

MiSmartLightBulb.prototype.setColorTemperature = function(value, callback) {
    var that = this;
	that.platform.log.debug("[MiLightPlatform][DEBUG]MiSmartLightBulb - Light - setColorTemperature Value: " + value);
    this.device.call("set_ct_abx", [value,'sudden',500]).then(result => {
        that.platform.log.debug("[MiLightPlatform][DEBUG]MiSmartLightBulb - Light - setColorTemperature Result: " + result);
        if(result[0] === "ok") {
            callback(null);
        } else {
            callback(new Error(result[0]));
        }
    }).catch(function(err) {
        that.platform.log.error("[MiLightPlatform][ERROR]MiSmartLightBulb - Light - setColorTemperature Error: " + err);
        callback(err);
    });
}