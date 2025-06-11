/*
*
*	USB デバイス管理モジュール
*		USBDeviceManager.js
*		import { USBDeviceManager } from './modules/USBDeviceManager.js';
*	メンテナンス履歴
*		2025/01/XX Ver.1.0.0 新規作成
*
*******************************************************************/

import { NFCDataUtils } from './NFCDataUtils.js';
import { NFCErrorHandler, ERROR_CODES } from './NFCErrors.js';
import { 
	DEVICE_INFO_LIST, 
	USB_SETUP_COMMANDS, 
	USB_CLOSE_COMMANDS,
	USB_CONFIG,
	PROTOCOL_CONFIG,
	generateDeviceFilters,
	getDeviceInfo,
	isSupportedDevice 
} from './NFCConstants.js';

/**
 * USB デバイス管理クラス
 */
export class USBDeviceManager {
	constructor(options = {}) {
		this.debug = options.debug ?? false;
		this.warning = options.warning ?? true;
		
		// エラーハンドラー
		this.errorHandler = new NFCErrorHandler({ debug: this.debug, warning: this.warning });
		
		// デバイス関連
		this.device = null;
		this.config = {};
		this.recvBuffer = [];
		this.recv = null;
		
		// 通信設定
		this.currentSeq = 0;
		this.processName = '';
		
		// デバイスフィルタ
		this.deviceFilters = generateDeviceFilters();
		
		// ログ設定
		this.log = this.debug ? console.log : () => {};
		this.errorLog = console.error;
		this.warningLog = this.warning ? console.log : () => {};
	}

	/**
	 * USBデバイスへの接続
	 */
	async connect() {
		this.log('USBDeviceManager.connect: begin');
		this.processName = 'Connect USB Device';

		try {
			// 既存のペアリング済みデバイスをチェック
			const pairedDevices = await navigator.usb.getDevices();
			let targetDevice = null;
			let pairedCount = 0;

			if (pairedDevices.length > 0) {
				for (const device of pairedDevices) {
					if (this.deviceFilters.some(filter => 
						device.vendorId === filter.vendorId && 
						device.productId === filter.productId
					)) {
						pairedCount++;
						targetDevice = device;
					}
				}
			}

			// ペアリング済みデバイスが1つでなければ新たに選択
			if (pairedCount !== 1) {
				targetDevice = await navigator.usb.requestDevice({ 
					filters: this.deviceFilters 
				});
			}

			this.device = targetDevice;

			// デバイス情報の検証
			const productId = this.device.productId;
			if (!isSupportedDevice(productId)) {
				this.errorHandler.handleError({
					code: ERROR_CODES.UNSUPPORTED_DEVICE,
					message: `プロダクトID: ${productId}`
				});
			}

			// デバイス設定情報の構築
			this._buildDeviceConfig();

			this.log('USBDeviceManager.connect: end', this.device, this.config);
			this.processName = '';
			return this.device;

		} catch (error) {
			this.processName = '';
			throw error;
		}
	}

	/**
	 * USBデバイスのオープン
	 */
	async open() {
		this.log('USBDeviceManager.open: begin');
		this.processName = 'Open USB Device';

		try {
			await this.device.open();
			await this.device.selectConfiguration(this.config.confValue);
			await this.device.claimInterface(this.config.interfaceNum);

			this.config.Open = {};
			await this._executeControlCommands(USB_SETUP_COMMANDS, this.config.Open);

			this.log('USBDeviceManager.open: end', this.config);
			this.processName = '';

		} catch (error) {
			this.processName = '';
			throw error;
		}
	}

	/**
	 * USBデバイスのクローズ
	 */
	async close() {
		this.log('USBDeviceManager.close: begin');
		this.processName = 'Close USB Device';

		let result = true;

		if (this.device !== null) {
			try {
				this.config.Close = {};
				await this._executeControlCommands(USB_CLOSE_COMMANDS, this.config.Close);
				
				await this.device.close();
			} catch (error) {
				const errorObj = {
					code: ERROR_CODES.USB_CLOSE_FAILED,
					message: error.message
				};
				this.errorHandler.handleError(errorObj);
				result = errorObj;
			}

			// 状態をリセット
			this.device = null;
			this.config = {};
			this.recvBuffer = [];
			this.recv = null;
		}

		await NFCDataUtils.sleep(30);
		this.log('USBDeviceManager.close: end');
		this.processName = '';
		return result;
	}

	/**
	 * データ送信
	 */
	async transmit(data) {
		this.log('USBDeviceManager.transmit: begin');
		const endpointNum = this.config.endPointOutNum;
		const packetSize = this.config.endPointOutPacketSize;
		
		this.log(`*-* Send length: ${data.length} Max packetsize: ${packetSize}`);
		this.log('*-* Send:', NFCDataUtils.arrayToHexs(data, ' '));

		try {
			const result = await this.device.transferOut(endpointNum, Uint8Array.from(data));
			
			if (result.status !== 'ok') {
				this.errorHandler.handleError({
					code: ERROR_CODES.USB_TRANSFER_OUT_FAILED,
					message: result.status
				});
			}
			
			if (result.bytesWritten < data.length) {
				this.errorHandler.handleError({
					code: ERROR_CODES.USB_TRANSFER_OUT_SIZE_ERROR,
					message: `${result.bytesWritten}バイト`
				});
			}

			this.log('USBDeviceManager.transmit: end', result);
			return { Error: false };

		} catch (error) {
			this.log('USBDeviceManager.transmit: error', error);
			throw error;
		}
	}

	/**
	 * データ受信
	 */
	async receive(length, timeout) {
		this.log(`USBDeviceManager.receive: begin Length ${length} Timeout ${timeout}`);

		if (length <= 0) {
			this.errorHandler.handleError({
				code: ERROR_CODES.USB_RECEIVE_SIZE_ERROR,
				message: `${length}バイト`
			});
		}

		// 受信バッファに十分なデータがある場合
		if (this.recvBuffer.length >= length) {
			const data = this._getBufferData(length);
			this.log('** receive: from receive buffer', data);
			return { Error: false, data };
		}

		// 新たに受信が必要な場合
		const startTime = Date.now();
		
		while (this.recvBuffer.length < length) {
			await this._transferIn();
			
			const elapsed = Date.now() - startTime;
			if (elapsed > timeout) {
				this.errorHandler.handleError({
					code: ERROR_CODES.USB_RECEIVE_TIMEOUT,
					message: `${timeout}(ms)`
				});
			}
		}

		const data = this._getBufferData(length);
		this.log('USBDeviceManager.receive: end', data);
		return { Error: false, data };
	}

	/**
	 * 受信バッファクリア
	 */
	async clear() {
		this.log('USBDeviceManager.clear: begin');
		this.recvBuffer = [];
		this.log('USBDeviceManager.clear: end');
	}

	/**
	 * エンドポイント情報取得
	 */
	getEndpoint(direction) {
		const endpoints = this.device.configuration
			.interfaces[this.device.configuration.configurationValue]
			.alternate.endpoints;
		
		return endpoints.find(ep => ep.direction === direction) || null;
	}

	/**
	 * デバイス設定情報の構築
	 */
	_buildDeviceConfig() {
		const productId = this.device.productId;
		const deviceInfo = getDeviceInfo(productId);

		this.config.ProductId = productId;
		this.config.ModelName = deviceInfo.modelName;
		this.config.DeviceType = deviceInfo.deviceType;
		this.config.ManufacturerName = this.device.manufacturerName;
		this.config.SerialNumber = this.device.serialNumber;
		this.config.ProductName = this.device.productName;

		this.config.Filters = [...this.deviceFilters];
		this.config.confValue = this.device.configuration.configurationValue;
		this.config.interfaceNum = this.device.configuration
			.interfaces[this.config.confValue].interfaceNumber;

		// エンドポイント情報
		const inEndpoint = this.getEndpoint(PROTOCOL_CONFIG.ENDPOINT.IN);
		this.config.endPointInNum = inEndpoint.endpointNumber;
		this.config.endPointInPacketSize = inEndpoint.packetSize;

		const outEndpoint = this.getEndpoint(PROTOCOL_CONFIG.ENDPOINT.OUT);
		this.config.endPointOutNum = outEndpoint.endpointNumber;
		this.config.endPointOutPacketSize = outEndpoint.packetSize;
	}

	/**
	 * 制御コマンドの実行
	 */
	async _executeControlCommands(commands, resultContainer) {
		for (const [key, command] of Object.entries(commands)) {
			this.log(`*--* ${key}: Start`);
			
			const response = await this.escapeTransferTarget(command.Com, 400);
			resultContainer[key] = NFCDataUtils.arraySlice(response, 0, response.length - 2);
			
			this.log(`*--* ${key}: End`, NFCDataUtils.arrayToHexs(resultContainer[key]));
			
			if (command.Sleep > 0) {
				await NFCDataUtils.sleep(command.Sleep);
			}
		}
	}

	/**
	 * 受信バッファからデータ取得
	 */
	_getBufferData(length) {
		this.log(`getBufferData: begin ${length}`, NFCDataUtils.arrayToHexs(this.recvBuffer));

		let result = [];
		if (this.recvBuffer.length >= length) {
			result = NFCDataUtils.arraySlice(this.recvBuffer, 0, length);
			this.recvBuffer = NFCDataUtils.arraySlice(
				this.recvBuffer, 
				length, 
				this.recvBuffer.length - length
			);
		}

		this.log('getBufferData: end', NFCDataUtils.arrayToHexs(result));
		return result;
	}

	/**
	 * USB TransferIn実行
	 */
	async _transferIn() {
		this.log('transferIn: begin');
		
		try {
			const result = await this.device.transferIn(
				this.config.endPointInNum, 
				USB_CONFIG.MAX_RECEIVE_SIZE
			);

			this.log(`transferIn status: ${result.status}`);
			this.log(`data.byteLength: ${result.data.byteLength}`);

			if (result.status !== 'ok' || result.data.byteLength === 0) {
				this.errorHandler.handleError({
					code: ERROR_CODES.USB_TRANSFER_IN_FAILED,
					message: `${result.status} ${result.data.byteLength}バイト`
				});
			}

			const data = NFCDataUtils.dataViewToArray(result.data);
			this.log('transferIn data:', NFCDataUtils.arrayToHexs(data));

			NFCDataUtils.arrayCopy(
				this.recvBuffer, 
				this.recvBuffer.length, 
				data, 
				0, 
				data.length
			);

			this.recv = null;
			this.log('transferIn: end');

		} catch (error) {
			this.log('transferIn: error', error);
			throw error;
		}
	}

	/**
	 * 連番生成
	 */
	getSequenceNumber() {
		this.currentSeq++;
		if (this.currentSeq > 255) {
			this.currentSeq = 0;
		}
		return this.currentSeq;
	}

	/**
	 * RDRヘッダ組み立て
	 */
	assembleRDRHeader(command, seqNum) {
		const commandLength = command.length;
		const rdrCommand = new Uint8Array(10 + commandLength);

		rdrCommand[0] = 0x6b;
		rdrCommand[1] = commandLength & 0xFF;
		rdrCommand[2] = (commandLength >> 8) & 0xFF;
		rdrCommand[3] = (commandLength >> 16) & 0xFF;
		rdrCommand[4] = (commandLength >> 24) & 0xFF;
		rdrCommand[5] = USB_CONFIG.SLOT_NUMBER;
		rdrCommand[6] = seqNum;

		if (commandLength > 0) {
			rdrCommand.set(command, 10);
		}

		return rdrCommand;
	}

	/**
	 * RDRヘッダ分解
	 */
	disassembleRDRHeader(rdrHeader) {
		return {
			Data: rdrHeader,
			HeaderLength: rdrHeader.length,
			Type: rdrHeader[0],
			Length: rdrHeader[4] << 24 | rdrHeader[3] << 16 | rdrHeader[2] << 8 | rdrHeader[1],
			Slot: rdrHeader[5],
			SeqNum: rdrHeader[6],
			ICCStatus: rdrHeader[7] & 3,
			ComStatus: (rdrHeader[7] >> 6) & 3,
			HeaderError: rdrHeader[8]
		};
	}

	/**
	 * RDRヘッダ検証
	 */
	checkRDRHeader(rdrResponse, expectedSeq) {
		if (rdrResponse.HeaderLength < 10) {
			return { code: ERROR_CODES.RDR_HEADER_LENGTH_ERROR, message: rdrResponse.HeaderLength.toString() };
		}
		if (rdrResponse.Type !== 0x83) {
			return { code: ERROR_CODES.RDR_HEADER_TYPE_ERROR, message: '' };
		}
		if (rdrResponse.Slot !== USB_CONFIG.SLOT_NUMBER) {
			return { code: ERROR_CODES.RDR_HEADER_SLOT_ERROR, message: rdrResponse.Slot.toString() };
		}
		if (rdrResponse.SeqNum !== expectedSeq) {
			return { code: ERROR_CODES.RDR_HEADER_SEQ_MISMATCH, message: `[${rdrResponse.SeqNum}]-[${expectedSeq}]` };
		}
		if (rdrResponse.ComStatus === 0) {
			return { code: ERROR_CODES.SLOT_STATUS_NORMAL, message: '' };
		}
		if (rdrResponse.ComStatus === 1) {
			return { code: ERROR_CODES.SLOT_STATUS_ERROR, message: '' };
		}
		if (rdrResponse.ComStatus === 2) {
			return { code: ERROR_CODES.SLOT_TIME_EXTENSION, message: '' };
		}
		if (rdrResponse.ICCStatus === 0) {
			return { code: ERROR_CODES.ICC_ACTIVE, message: '' };
		}
		if (rdrResponse.ICCStatus === 1) {
			return { code: ERROR_CODES.ICC_INACTIVE, message: '' };
		}
		if (rdrResponse.ICCStatus === 2) {
			return { code: ERROR_CODES.ICC_NOT_EXIST, message: '' };
		}
		
		return false; // エラーなし
	}

	/**
	 * エスケープ転送ターゲット
	 */
	async escapeTransferTarget(command, receiveTimeout) {
		this.log('escapeTransferTarget: begin', receiveTimeout);

		const seqNum = this.getSequenceNumber();
		const transmitCommand = this.assembleRDRHeader(command, seqNum);

		this.log('escapeTransferTarget: Tcom', NFCDataUtils.arrayToHexs(transmitCommand));

		// データ送信
		const transmitResult = await this.transmit(transmitCommand);
		this.errorHandler.handleError(transmitResult.Error);

		// レスポンス受信（ヘッダー）
		await this.clear();
		const headerResult = await this.receive(10, receiveTimeout);
		this.errorHandler.handleError(headerResult.Error);

		// RDRヘッダー分析
		const rdrResponse = this.disassembleRDRHeader(headerResult.data);
		this.log('escapeTransferTarget: RDRHeader', rdrResponse);
		
		const rdrError = this.checkRDRHeader(rdrResponse, seqNum);
		this.errorHandler.handleError(rdrError);

		// データ部受信
		this.log('escapeTransferTarget: RDRData', rdrResponse.Length);
		const dataResult = await this.receive(rdrResponse.Length, receiveTimeout);
		this.log('escapeTransferTarget: RDRData res', dataResult);
		this.errorHandler.handleError(dataResult.Error);

		this.log('escapeTransferTarget: end', NFCDataUtils.arrayToHexs(dataResult.data));
		return dataResult.data;
	}
}