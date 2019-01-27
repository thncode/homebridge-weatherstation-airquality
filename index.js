var Service, Characteristic, HomebridgeAPI, UUIDGen, FakeGatoHistoryService;
var inherits = require('util').inherits;
var os = require("os");
var hostname = os.hostname();
const fs = require('fs');
const moment = require('moment');

const readFile = "/root/.homebridge/airquality.txt";

var PPM25, PPM10, battery, readtime;

module.exports = function (homebridge) {
	
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    HomebridgeAPI = homebridge;
    UUIDGen = homebridge.hap.uuid;
    FakeGatoHistoryService = require("fakegato-history")(homebridge);

    homebridge.registerAccessory("homebridge-weatherstation-airquality", "WeatherStationAirQuality", WeatherStationAirquality);
};


function WeatherStationAirquality(log, config) {
	
    var that = this;
    this.log = log;
    this.name = config.name;
    this.displayName = this.name;
    this.deviceId = config.deviceId;

    this.config = config;

    this.storedData = {};

    this.setUpServices();

    this.readData();
    
   	fs.watch(readFile, (event, filename) => {
   		if (event === 'change') this.readData();
   	});
};


WeatherStationAirquality.prototype.readData = function () {

	var data = fs.readFileSync(readFile, "utf-8");
	var lastSync = Date.parse(data.substring(0, 19));
	if (readtime == lastSync) return;
	readtime = lastSync;

	PPM25 = parseFloat(data.substring(20));
	PPM10 = parseFloat(data.substring(26));
	battery = parseFloat(data.substring(32));
	
	var ppm;
	if (PPM10 < 21) ppm = PPM10 * 35;
	else if (PPM10 < 36) ppm = (PPM10 - 21) * 28.57 + 701;
	else if (PPM10 < 51) ppm = (PPM10 - 36) * 35.64 + 1101;
	else if (PPM10 < 101) ppm = (PPM10 - 51) * 10.184 + 1601;
	else ppm = (PPM10 - 101) * 10.184 + 2101;
	

	this.log("Air quality data: ", PPM25, PPM10, ppm, battery);

	this.fakeGatoHistoryService.addEntry({ time: moment().unix(), temp: 0, humidity: 0, ppm: ppm });

	this.airQualityService.getCharacteristic(Characteristic.PM2_5Density).updateValue(PPM25, null);
	this.airQualityService.getCharacteristic(Characteristic.PM10Density).updateValue(PPM10, null);
	this.airQualityService.getCharacteristic(Characteristic.AirQuality).updateValue(2, null);
    //this.batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(null);
}; 


WeatherStationAirquality.prototype.getFirmwareRevision = function (callback) {
    return callback(null, '1.0.0');
};


WeatherStationAirquality.prototype.getBatteryLevel = function (callback) {
	var perc = (battery - 0.8) * 100;
    return callback(null,perc);
};


WeatherStationAirquality.prototype.getStatusActive = function (callback) {
    return callback(null, true);
};


WeatherStationAirquality.prototype.getStatusLowBattery = function (callback) {
    return callback(null, battery >= 0.8 ? Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL : Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
};


WeatherStationAirquality.prototype.getPM2_5Density = function (callback) {
    return callback(null, PPM25);
};


WeatherStationAirquality.prototype.getPM10Density = function (callback) {	
    return callback(null, PPM10);
};


WeatherStationAirquality.prototype.getAirQuality = function (callback) {	
//	Characteristic.AirQuality.UNKNOWN = 0;
//	Characteristic.AirQuality.EXCELLENT = 1;
//	Characteristic.AirQuality.GOOD = 2;
//	Characteristic.AirQuality.FAIR = 3;
//	Characteristic.AirQuality.INFERIOR = 4;
//	Characteristic.AirQuality.POOR = 5;
	if (PPM10 < 21) return callback(null, 1);
	if (PPM10 < 36) return callback(null, 2);
	if (PPM10 < 51) return callback(null, 3);
	if (PPM10 < 101) return callback(null, 4);
	return callback(null, 5);
};


WeatherStationAirquality.prototype.getEveAirQuality = function (callback) {	
	Characteristic.AirQuality.GOOD = 2;
    return callback(null, 2);
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

    this.airQualityService = new Service.AirQualitySensor('Luftqualität');

    this.airQualityService.getCharacteristic(Characteristic.StatusLowBattery)
    .on('get', this.getStatusLowBattery.bind(this));
    this.airQualityService.getCharacteristic(Characteristic.StatusActive)
    .on('get', this.getStatusActive.bind(this));
        
    this.fakeGatoHistoryService = new FakeGatoHistoryService("room", this, { storage: 'fs' });

    var CustomCharacteristic = {};
    
    CustomCharacteristic.AirQuality = function () {
		Characteristic.call(this, 'Air Quality PM25', 'E863F10B-079E-48FF-8F27-9C2605A29F52');
        this.setProps({
            format: Characteristic.Formats.UINT16,
            unit: "ppm",
            maxValue: 3000,
            minValue: 0,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    CustomCharacteristic.AirQuality.uuid = 'E863F10B-079E-48FF-8F27-9C2605A29F52';
    inherits(CustomCharacteristic.AirQuality, Characteristic);

    CustomCharacteristic.EveAirQuality = function () {
		Characteristic.call(this, 'Eve Air Quality', 'E863F10B-079E-48FF-8F27-9C2605A29F52');
        this.setProps({
            format: Characteristic.Formats.FLOAT,
            unit: "ppm",
            maxValue: 3000,
            minValue: 0,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    CustomCharacteristic.EveAirQuality.UUID = 'E863F10B-079E-48FF-8F27-9C2605A29F52';
    inherits(CustomCharacteristic.EveAirQuality, Characteristic);

    this.airQualityService.getCharacteristic(Characteristic.AirQuality)
	.on('get', this.getAirQuality.bind(this));
    this.airQualityService.getCharacteristic(CustomCharacteristic.EveAirQuality)
	.on('get', this.getEveAirQuality.bind(this));

	this.airQualityService
	.setCharacteristic(Characteristic.AirParticulateSize, '10um');
			    
    this.airQualityService.getCharacteristic(Characteristic.PM2_5Density)
	.on('get', this.getPM2_5Density.bind(this));
    this.airQualityService.getCharacteristic(Characteristic.PM10Density)
	.on('get', this.getPM10Density.bind(this));
};


WeatherStationAirquality.prototype.getServices = function () {
    var services = [this.informationService, this.batteryService, this.fakeGatoHistoryService, this.airQualityService];

    return services;
};
