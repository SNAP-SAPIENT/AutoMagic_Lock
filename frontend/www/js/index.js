// (c) 2014 Don Coleman
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* global mainPage, deviceList, refreshButton */
/* global detailPage, resultDiv, messageInput, sendButton, disconnectButton */
/* global ble  */
/* jshint browser: true , devel: true*/
'use strict';

// ASCII only
function bytesToString(buffer) {
    return String.fromCharCode.apply(null, new Uint8Array(buffer));
}

// ASCII only
function stringToBytes(string) {
    var array = new Uint8Array(string.length);
    for (var i = 0, l = string.length; i < l; i++) {
        array[i] = string.charCodeAt(i);
    }
    return array.buffer;
}

// this is Nordic's UART service
var bluefruit = {
    serviceUUID: "6E400001-B5A3-F393-E0A9-E50E24DCCA9E",
    txCharacteristic: "6E400002-B5A3-F393-E0A9-E50E24DCCA9E", // transmit is from the phone's perspective
    rxCharacteristic: "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"  // receive is from the phone's perspective
};

//var bleAddr = "D8:39:19:E9:37:F2";
var bleAddr = "D9:C9:A3:95:71:AC",
    rssi = 0,
    countdownInit = false,
    firstConnect = true,
    disconnected = false,
    lastPage = lockPage,
    lastAction,
    locked = false,
    currentAction,
    dataWaiting = false,
    tempArray = [],
    oldMedian =0,
    oldDistance = -600,
    medianCounter = 0,
    proximityNames = [
        'unknown',
        'immediate',
        'near',
        'far'],
    locked = false,
    unlockCmdSent = false,
    justLocked = false,
    heartbeat = null;

var app = {
    initialize: function() {
        this.showLoadingIndicator(false);
        this.bindEvents();
    },
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        //refreshButton.addEventListener('touchstart', this.refreshDeviceList, false);
        //sendButton.addEventListener('click', this.sendData, false);
        //disconnectButton.addEventListener('touchstart', this.disconnect, false);
        //deviceList.addEventListener('touchstart', this.connect, false); // assume not scrolling

        lockButton.addEventListener('mousedown',this.animateButton, false);
        unlockButton.addEventListener('touchstart',this.updateLock, false);


        nearestLock.addEventListener('click',this.displayMapPage,false);
        menuNearestLock.addEventListener('click',this.displayMapPage,false);

        navList.addEventListener('click',this.displayNav,false);
        document.addEventListener('backbutton', this.disconnectBLE, false);
        document.addEventListener('menubutton', this.disconnectBLE, false);


        magicLockLogoButton.addEventListener('click',this.showMainPage,false);
        menuMagicLockLogoButton.addEventListener('click',this.showMainPage,false);

        /*
        'lockDevice': function(e) {
        if(e.type === 'touchend') {
            console.log('pressed');
            untouchedBtn.hidden = false;
            touchedBtn.hidden = true;
        } else if(e.type === 'touchstart') {
            console.log('unpressed');
            untouchedBtn.hidden = true;
            touchedBtn.hidden = false;
        }

        app.sendData(e.target.getAttribute('data-command'));
    },
    */
    },
    displayMapPage: function() {
        console.log('display map page');
        app.displayPage(mapPage);
    },
    displayNav: function(e) {
        var $nav = $('.nav');
        //console.log($(e.target));
        //$('.nav').toggleClass('show');

        if($nav.hasClass('showing')) {

            $nav.animate({
                marginLeft: '-300px',
            },450, 'linear', function() {
                $nav.removeClass('showing');
            });
        } else {
            $nav.animate({
            marginLeft: '0px',
            },450, 'linear', function() {
                $nav.addClass('showing');
            });
        }
    },
    updateLock: function(e) {

        e.stopPropagation();
        app.sendData(e.target.getAttribute('data-command'));
    },
    animateButton: function() {
        $('.progress-bar').animate({
            width: '200px',
        },6000, function() {
        });
    },
    onDeviceReady: function() {
        app.showMainPage();

        //bluetoothle.initialize();
        app.setupHeartbeat();
        app.refreshDeviceList(true);
        app.locateBeacon();
    },
    refreshDeviceList: function(reconnect) {
        console.log('refreshDeviceList');
        if (cordova.platformId === 'android') { // Android filtering is broken
            ble.scan([], 5, 
                function(device) {
                    app.onDiscoverDevice(device,reconnect);
                }, 
                app.onError);
        } else {
            ble.scan([bluefruit.serviceUUID], 5,
                function(device) {
                    app.onDiscoverDevice(device,reconnect);
                },
                app.onError);
        }
    },
    onDiscoverDevice: function(device,updateScreen) {
        if(device.id === bleAddr)  {
            rssi = device.rssi;
            //alert('device discovered');

            //app.monitorDistance(rssi);
            app.showLoadingIndicator(true);
            app.connect(updateScreen);
        }
    },
    connect: function(updateScreen) {
        var deviceId = bleAddr,
            onConnect = function() {
                console.log('connected go');
                    disconnected = false;
                    app.showLoadingIndicator(false);
                    // subscribe for incoming data
                    ble.startNotification(deviceId, bluefruit.serviceUUID, bluefruit.rxCharacteristic, app.onData, app.onError);
                    
                    
                    if(firstConnect === true) {
                        app.sendData('c');
                        firstConnect = false;
                    }

                    if(dataWaiting === true) {
                        app.sendData(currentAction);
                    }

                    //console.log(updateScreen);
                    /*
                    if(updateScreen === true) {
                        app.showLockPage();
                    } else {
                        app.displayPage(lastPage);
                    }*/

            };
        ble.connect(deviceId, onConnect, app.onError);
    },
    onData: function(data) { // data received from Arduino

        var response = bytesToString(data),
            result = "";

            if(response === "l") {
                if(locked !== true) {
                    justLocked = true;
                    app.setLockTimer();
                }

                locked = true;
                //app.showLoadingIndicator(false);
                
                //setTimeout(function() {
                    app.showLockedPage();
                //},200);
                
            } else if(response === "u"){
                unlockCmdSent = false;
                locked = false;
                //app.showUnlockedPage();
                //app.showLoadingIndicator(false);
                //setTimeout(function() {
                    app.showUnlockedPage();
                //},200);
            }

    },
    sendData: function(command) { // send data to Arduino

        console.log('send data ' +command);

        if(currentAction !== 'c') {
            lastAction = currentAction;
            //app.showLoadingIndicator(true);

        }

        currentAction = command;

        if(disconnected === false) {
            //console.log('not disconnected');
            dataWaiting = false;
            var success = function() {
                //console.log("success");

            };

            var failure = function() {
                dataWaiting = true;
                return;
            };

            var data = stringToBytes(command);
            
            //console.log(data);
            ble.writeWithoutResponse(bleAddr, bluefruit.serviceUUID, bluefruit.txCharacteristic, data, success, failure);
        } else {
            dataWaiting = true;
        }
    },
    disconnect: function(event) {
        var deviceId = bleAddr;
        ble.disconnect(deviceId, app.handleDisconnect, app.onError);
    },
    handleDisconnect: function() {
        disconnected = true;
        console.log('disconnected');
    },
    showMainPage: function() {
        //console.log('show main page');
        app.displayPage(mainPage);
    },
    showLockPage: function() {
        $('.progress-bar').css('width','0px');
        app.displayPage(lockPage);
    },
    showConnectingPage: function() {
        app.displayPage(connectingPage);
    },
    showLockedPage: function() {
        app.displayPage(lockedPage);

        if(countdownInit === false) {
            var timer = new Date(); 
                timer.setDate(timer.getDate()+1);

            $('.countdown').countdown({
                date: timer,
                render: function(data) {
                    $(this.el).html('<span>' + this.leadingZeros(data.hours, 2) + '</span>:<span>' + this.leadingZeros(data.min, 2) + '</span>:<span>'+this.leadingZeros(data.sec,2)+'</span>');
                  }
            });

            countdownInit = true;
        }
    },
    setLockTimer: function() {
        //give person 30 seconds to get out of range after lock
        setTimeout(function() {
            justLocked = false;
        },20000);
    },
    showUnlockedPage: function() {
        if(countdownInit === true) {
            countdownInit = false;
            $('.countdown').data('countdown').stop();
            $('.countdown').unbind().removeData();
        }

        app.displayPage(unlockedPage);

        //after 3 seconds, take it back to the initial lock state
        setTimeout(function() {
            app.showMainPage();
        },3000);
    },
    displayPage: function(page) {
        mainPage.hidden = true;
        lockPage.hidden = true;
        connectingPage.hidden = true;
        lockedPage.hidden = true;
        unlockedPage.hidden = true;
        mapPage.hidden = true;

        page.hidden = false;

        lastPage = page;
    },
    showLoadingIndicator: function(show,page) {
        if(show) {
            console.log('show indicator');
            loadingOverlay.hidden = false;
            $('#loadingOverlay').css({
                'zIndex':'900',
                'display':'block'
            });
        } else {
            setTimeout(function() {
                loadingOverlay.hidden = true;
                console.log('hide indicator');
                $('#loadingOverlay').css({
                    'zIndex':'0',
                    'display':'none'
                });
            },3000); 
        }
    },
    onError: function(reason) {
        //app.refreshDeviceList(false);

        if(reason === "Disconnected") {
            app.refreshDeviceList(false);
        }
        console.log("ERROR: " + reason); // real apps should use notification.alert
    },
    setupHeartbeat: function() {
        heartbeat = setInterval(function() {
            app.checkConnection();
            app.locateBeacon();
        },2000);

        /*
        setInterval(function() {
            if(justLocked === false) {
                app.locateBeacon();
            }
        },1000);*/
    },
    checkConnection: function() {
        ble.isConnected(
            bleAddr,
            function() {
                app.sendData("c");
            },
            function() {
                app.refreshDeviceList(false);
            }
        );
    },

    monitorDistance: function(newDistance) {
        //console.log('-------------------');
        //console.log(tempArray);
        
        tempArray.push(newDistance);

        if(tempArray.length === 6) {
            tempArray.shift();
        }

        
        var newTempArray = [];
            newTempArray = tempArray.slice(0);
        
        var median = app.median(newTempArray);

        if(median < 0.75) {
            if(locked === true && unlockCmdSent === false && justLocked === false) {
                app.sendData('u');
            }
        }
    },
    median: function(values) {
 
        values.sort( function(a,b) {return a - b;} );
     
        var half = Math.floor(values.length/2);
     
        if(values.length % 2)
            return values[half];
        else
            return (values[half-1] + values[half]) / 2.0;
    },
    locateBeacon: function() {
        app.startRangingBeacons();
    },
    startRangingBeacons : function()
    {
        function onRange(beaconInfo)
        {
            displayBeconInfo(beaconInfo);
        }

        function onError(errorMessage)
        {
            console.log('Range error: ' + errorMessage);
        }

        function displayBeconInfo(beaconInfo)
        {
            // Generate HTML for beacons.
            $.each(beaconInfo.beacons, function(key, beacon)
            {
                if(beacon.macAddress === "EF:87:D5:B1:67:A9") {
                    //console.log(beacon);
                    //console.log(beacon.rssi);

                    $('#proximity').html(app.formatProximity(beacon.proximity));
                    $('#distance').html(app.formatDistance(beacon.distance));

                    //if(app.distance)
                    app.monitorDistance(beacon.distance);
                    //break;
                }
                //console.log(beaconInfo);
            });
        };

       // app.showRangeBeaconsScreen();

        estimote.beacons.requestAlwaysAuthorization();

        estimote.beacons.startRangingBeaconsInRegion(
            {}, // Empty region matches all beacons.
            onRange,
            onError);
    },

    stopRangingBeacons : function()
    {
        estimote.beacons.stopRangingBeaconsInRegion({});
        //app.showHomeScreen();
    },
    //return cm
    formatDistance: function(meters)
    {
        if (!meters) { return 'Unknown'; }

        return (meters * 100).toFixed(3);
    },

    formatProximity:function(proximity)
    {
        if (!proximity) { return 'Unknown'; }

        // Eliminate bad values (just in case).
        proximity = Math.max(0, proximity);
        proximity = Math.min(3, proximity);

        // Return name for proximity.
        return proximityNames[proximity];
    },
    disconnectBLE: function(e) {
        //alert('disconnect');
        app.disconnect(e);
        
        if(heartbeat !== null) {
            clearInterval(heartbeat);
        }
        //document.removeEventListener(this.disconnectBLE, false);
        
        if (navigator.app) {
           navigator.app.exitApp();
        }
        else if (navigator.device) {
            navigator.device.exitApp();
        }
    }

};