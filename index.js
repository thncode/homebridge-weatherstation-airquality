var Service, Characteristic, HomebridgeAPI, UUIDGen, FakeGatoHistoryService;
var inherits = require('util').inherits;
var os = require("os");
var hostname = os.hostname();
const fs = require('fs');
const moment = require('moment');


var intervalID;

const readFile = "/home/pi/WeatherStation/airquality.txt";

var PPM25;
var PPM10;
var battery;

var glog;
var ctime;

module.exports = function (homebridge) {
	
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    HomebridgeAPI = homebridge;
    FakeGatoHistoryService = require("fakegato-history")(homebridge);

    homebridge.registerAccessory("homebridge-weatherstation-airquality", "WeatherStationAirQuality", WeatherStationAirquality);
};


function read() {
	var data = fs.readFileSync(readFile, "utf-8");
	var lastSync = Date.parse(data.substring(0, 19));
	PPM25 = parseFloat(data.substring(20));
	PPM10 = parseFloat(data.substring(26));
	battery = parseFloat(data.substring(32));
}


function WeatherStationAirquality(log, config) {
    var that = this;
    this.log = glog = log;
    this.name = config.name;
    this.displayName = this.name;
    this.deviceId = config.deviceId;
    this.interval = Math.min(Math.max(config.interval, 1), 60);

    this.config = config;

    this.storedData = {};

    this.setUpServices();
    
    read();

	intervalID = setInterval(function() {
		
		var stats = fs.statSync(readFile);
		
		var doit = false;
		if (ctime) {
			if (ctime.getTime() != stats.mtime.getTime()) {
				ctime = stats.mtime;
				doit = true;
			}
		}
		else {
			ctime = stats.mtime;
			doit = true;
		}
		
		// doit = true;
			
		if (doit) {
			read();
			glog("Air quality data: ", PPM25, PPM10, battery);

			that.fakeGatoHistoryService.addEntry({
				time: moment().unix(),
				temp: 0,
				humidity: 0,
				ppm: PPM25
				});
		}
	}, 2000);
};


WeatherStationAirquality.prototype.getFirmwareRevision = function (callback) {
    callback(null, '1.0.0');
};


WeatherStationAirquality.prototype.getBatteryLevel = function (callback) {
	var perc = (battery - 0.8) * 100;
    callback(null,perc);
};


WeatherStationAirquality.prototype.getStatusActive = function (callback) {
    callback(null, true);
};


WeatherStationAirquality.prototype.getStatusLowBattery = function (callback) {
    callback(null, battery >= 0.8 ? Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL : Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
};


WeatherStationAirquality.prototype.getPM2_5Density = function (callback) {	
    callback(null, PPM25);
};


WeatherStationAirquality.prototype.getPM10Density = function (callback) {	
    callback(null, PPM10);
};


WeatherStationAirquality.prototype.getAirQuality = function (callback) {	
//	Characteristic.AirQuality.UNKNOWN = 0;
//	Characteristic.AirQuality.EXCELLENT = 1;
	Characteristic.AirQuality.GOOD = 2;
//	Characteristic.AirQuality.FAIR = 3;
//	Characteristic.AirQuality.INFERIOR = 4;
//	Characteristic.AirQuality.POOR = 5;
    callback(null, 2);
};


WeatherStationAirquality.prototype.getEveAirQuality = function (callback) {	
	Characteristic.AirQuality.GOOD = 2;
    callback(null, 2);
};


WeatherStationAirquality.prototype.setUpServices = function () {
    // info service
    this.informationService = new Service.AccessoryInformation();

    this.informationService
        .setCharacteristic(Characteristic.Manufacturer, "THN Systems")
        .setCharacteristic(Characteristic.Model, "WeatherStationAirQuality")
        .setCharacteristic(Characteristic.SerialNumber, hostname + "-" + this.name + "1")
    this.informationService.getCharacteristic(Characteristic.FirmwareRevision)
        .on('get', this.getFirmwareRevision.bind(this));
        
    this.batteryService = new Service.BatteryService(this.name);
    this.batteryService.getCharacteristic(Characteristic.BatteryLevel)
        .on('get', this.getBatteryLevel.bind(this));
    this.batteryService.setCharacteristic(Characteristic.ChargingState, Characteristic.ChargingState.NOT_CHARGEABLE);
    this.batteryService.getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', this.getStatusLowBattery.bind(this));
        
    this.fakeGatoHistoryService = new FakeGatoHistoryService("room", this, { storage: 'fs' });

    var CustomCharacteristic = {};
    
    CustomCharacteristic.AirQuality = function () {
		Characteristic.call(this, 'Air Quality PM25', 'E863F10B-079E-48FF-8F27-9C2605A29F52');
        this.setProps({
            format: Characteristic.Formats.UINT16,
            unit: "ppm",
            maxValue: 99999,
            minValue: 2,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    CustomCharacteristic.AirQuality.uuid = 'E863F10B-079E-48FF-8F27-9C2605A29F52';
    inherits(CustomCharacteristic.AirQuality, Characteristic);

    CustomCharacteristic.EveAirQuality = function () {
		Characteristic.call(this, 'Eve Air Quality', 'E863F11B-079E-48FF-8F27-9C2605A29F52');
        this.setProps({
            format: Characteristic.Formats.FLOAT,
            unit: "ppm",
            maxValue: 5000,
            minValue: 0,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    CustomCharacteristic.EveAirQuality.UUID = 'E863F11B-079E-48FF-8F27-9C2605A29F52';
    inherits(CustomCharacteristic.EveAirQuality, Characteristic);
    	    
    // AirQuality sensor
    airQualitySensor = function (displayName, subtype) {
    let uuid = UUIDGen.generate('airQualitySensor');
    Service.call(this, displayName, uuid, subtype);

        this.addCharacteristic(Characteristic.AirQuality);
        this.addCharacteristic(CustomCharacteristic.EveAirQuality);
    };
    inherits(airQualitySensor, Service);
    //airQualitySensor.UUID = uuid;


    this.airQualityService = new Service.AirQualitySensor('Luftqualität');

	this.airQualityService
	.setCharacteristic(Characteristic.AirParticulateSize, '2.5um');
			    
    this.airQualityService.getCharacteristic(Characteristic.AirQuality)
	.on('get', this.getAirQuality.bind(this));
    this.airQualityService.getCharacteristic(CustomCharacteristic.EveAirQuality)
	.on('get', this.getEveAirQuality.bind(this));
    this.airQualityService.getCharacteristic(Characteristic.PM2_5Density)
	.on('get', this.getPM2_5Density.bind(this));
    this.airQualityService.getCharacteristic(Characteristic.PM10Density)
	.on('get', this.getPM10Density.bind(this));
    this.airQualityService.getCharacteristic(Characteristic.StatusLowBattery)
    .on('get', this.getStatusLowBattery.bind(this));
    this.airQualityService.getCharacteristic(Characteristic.StatusActive)
    .on('get', this.getStatusActive.bind(this));
};


WeatherStationAirquality.prototype.getServices = function () {
    var services = [this.informationService, this.batteryService, this.fakeGatoHistoryService, this.airQualityService];

    return services;
};
