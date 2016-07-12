/*********************************************************************
This is an example for our nRF8001 Bluetooth Low Energy Breakout

  Pick one up today in the adafruit shop!
  ------> http://www.adafruit.com/products/1697

Adafruit invests time and resources providing this open source code, 
please support Adafruit and open-source hardware by purchasing 
products from Adafruit!

Written by Kevin Townsend/KTOWN  for Adafruit Industries.
MIT license, check LICENSE for more information
All text above, and the splash screen below must be included in any redistribution
*********************************************************************/

// This version uses call-backs on the event and RX so there's no data handling in the main loop!

#include <SPI.h>
#include "Adafruit_BLE_UART.h"
#include <Servo.h>

#define ADAFRUITBLE_REQ 10
#define ADAFRUITBLE_RDY 2
#define ADAFRUITBLE_RST 9

Adafruit_BLE_UART uart = Adafruit_BLE_UART(ADAFRUITBLE_REQ, ADAFRUITBLE_RDY, ADAFRUITBLE_RST);

Servo motor;
int motorDeg = 0;
int motorPin = 5;

int prevButtonState = 0;
int buttonState = 1;
int buttonPin = 3;

int ledPin = 13;

int breakDeg = 15;

boolean reset = false;
boolean locked = false;

/* 
Sometimes I need to reset the Arduino. We don't want to keep hitting the button so here we go!! 
http://www.instructables.com/id/two-ways-to-reset-arduino-in-software/
*/
void(* resetDevice) (void) = 0;

/**************************************************************************/
/*!
    This function is called whenever select ACI events happen
*/
/**************************************************************************/
void aciCallback(aci_evt_opcode_t event)
{
  switch(event)
  {
    case ACI_EVT_DEVICE_STARTED:
      Serial.println(F("Advertising started"));
      digitalWrite(ledPin,LOW);
      break;
    case ACI_EVT_CONNECTED:
      Serial.println(F("Connected!"));
      //checkSwitch(); 
      digitalWrite(ledPin,HIGH);
      break;
    case ACI_EVT_DISCONNECTED:
      Serial.println(F("Disconnected or advertising timed out"));
      digitalWrite(ledPin,LOW);
      
      break;
    default:
      resetDevice();
      Serial.println("reset");
      break;
  }
  
  motor.write(0);
}

/**************************************************************************/
/*!
    This function is called whenever data arrives on the RX channel
*/
/**************************************************************************/
void rxCallback(uint8_t *buffer, uint8_t len)
{
  //processLockCommand();
  
  if((char)buffer[0] == 'c') {
    //Serial.println("check it, it's c");
    checkSwitch();
  } else if((char)buffer[0] == 'u') {
    processLockCommand('u');
  }
  
  /*
  Serial.print(F("Received "));
  Serial.print(len);
  Serial.print(F(" bytes: "));
  for(int i=0; i<len; i++)
   Serial.print((char)buffer[i]); 

  Serial.print(F(" ["));

  for(int i=0; i<len; i++)
  {
    Serial.print(" 0x"); Serial.print((char)buffer[i], HEX); 
  }
  Serial.println(F(" ]"));
   */
   
  /* Echo the same data back! */
  uart.write(buffer, len);
}

/**************************************************************************/
/*!
    Configure the Arduino and start advertising with the radio
*/
/**************************************************************************/
void setup(void)
{ 
  Serial.begin(9600);
  while(!Serial); // Leonardo/Micro should wait for serial init
  Serial.println(F("Adafruit Bluefruit Low Energy nRF8001 Callback Echo demo"));

  pinMode(ledPin,OUTPUT);
  pinMode(buttonPin,INPUT_PULLUP);
  
  uart.setRXcallback(rxCallback);
  uart.setACIcallback(aciCallback);
  // uart.setDeviceName("NEWNAME"); /* 7 characters max! */
  uart.begin();
  motor.attach(5);
  //update servo to verify it's hoxfoked up properly
  motor.write(0);
  
}

void processLockCommand(char c) {
  //while (uart.available()) {
    
     if (c == 'u') {
      int code = uart.parseInt();
      
      if(motorDeg == breakDeg && locked == true) {
        Serial.println("unlock");
        
        for(motorDeg = breakDeg; motorDeg>0; motorDeg-=1)     // goes from 180 degrees to 0 degrees
        {                               
          motor.write(motorDeg);              // tell servo to go to position in variable 'pos'
          delay(45);                       // waits 15ms for the servo to reach the position
        }
        
        locked = false;
        delay(2000);
      }
      
    }
  
    if(c == 'l') {
      //Serial.println("lock");
      if(motorDeg == 0 && locked == false) {
        Serial.println("lock");
        for(motorDeg = 0; motorDeg<breakDeg; motorDeg+=1)     // goes from 180 degrees to 0 degrees
        {                               
          motor.write(motorDeg);              // tell servo to go to position in variable 'pos'
          delay(45);                       // waits 15ms for the servo to reach the position
        }
        locked = true;
      }
     
    }
  //}
}

/**************************************************************************/
/*!
    Constantly checks for new events on the nRF8001
*/
/**************************************************************************/
void loop()
{
  uart.pollACI();
}

void checkSwitch() {
  //yes I know it is silly bear with me ok
  //prevButtonState = buttonState;
  
  /*if(prevButtonState != 0) {
    prevButtonState = 1;
  }*/

  buttonState = analogRead(buttonPin);
  
 //Serial.println("checkSwitch()");
 //Serial.print(buttonState);
 
 
 //if(buttonState != prevButtonState) {
    
   Serial.println(buttonState);
    if (buttonState <= 1000) { 
     prevButtonState = 1; 
     //Serial.println("high pin"); 
      
      //processLockCommand('u');
      //locked = false;
    } else {
      //Serial.println("locked via switch! gogoggogo");
      
      
      if(buttonState > 1000) {
         buttonState = 0;
      }
      
      if(buttonState != prevButtonState) {
        processLockCommand('l');
        writeValue('l');
      }
      //locked = true;
    }
    
    prevButtonState = buttonState;
    //delay(20);
  //}
}

void writeValue(char value) {
  uint8_t* buffer = new uint8_t[1];
  buffer[0] = (uint8_t)value;
  uart.write(buffer,1);
}
