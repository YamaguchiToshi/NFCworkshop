# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a JavaScript NFC communication library for FeliCa Lite-S cards, designed to work with USB card readers (Sony RC-S380, RC-S300 series). The codebase has been recently refactored from a monolithic structure into a modular architecture using the facade pattern.

## Architecture

**Core Design Pattern**: Facade Pattern
- `SimpleNFC.js` - Main facade class providing a unified, simple API
- Internally composed of specialized modules for different concerns
- Maintains backward compatibility with the original monolithic API

**Module Structure**:
- `SimpleNFC.js` - Main facade (entry point for users)
- `USBDeviceManager.js` - USB device connection and communication
- `FeliCaProtocol.js` - FeliCa card protocol implementation  
- `NFCDataUtils.js` - Data conversion and utility functions
- `NFCErrors.js` - Error handling and error code management
- `NFCConstants.js` - Device constants and command definitions
- `utils.js` - Legacy testing utilities (separate from main modules)

**Key Architectural Decisions**:
- All modules use ES6 imports/exports
- Error handling is centralized in NFCErrorHandler with structured error codes
- UTF-8 text encoding support with fallback to legacy encoding
- Backward compatibility maintained through method delegation in SimpleNFC

## Usage Patterns

**Basic Usage**:
```javascript
import { SimpleNFC } from './modules/SimpleNFC.js';

const nfc = new SimpleNFC({ debug: true });
await nfc.connectUSBDevice();
await nfc.openUSBDevice();
await nfc.pollingLiteS();
const result = await nfc.readLiteS({ Block: [4, 5, 6] });
```

**Supported Operations**:
- USB device connection and management
- FeliCa Lite-S card polling, reading, and writing
- UTF-8 text data handling with 16-byte block constraints

## Development Notes

- This is a browser-based library using WebUSB API
- No build system or package.json - uses native ES modules
- Japanese comments throughout the codebase
- Error codes range from 100-900 with specific meanings
- All text data operations support UTF-8 encoding with proper byte boundary handling
- The facade pattern allows internal refactoring without breaking existing code