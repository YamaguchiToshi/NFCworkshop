/*
*
*	FeliCa プロトコル処理モジュール
*		FeliCaProtocol.js
*		import { FeliCaProtocol } from './modules/FeliCaProtocol.js';
*	メンテナンス履歴
*		2025/01/XX Ver.1.0.0 新規作成
*
*******************************************************************/

import { NFCDataUtils } from './NFCDataUtils.js';
import { NFCErrorHandler, ERROR_CODES } from './NFCErrors.js';
import { 
	FELICA_COMMANDS, 
	USB_POLLING_COMMANDS, 
	RESPONSE_CODES 
} from './NFCConstants.js';

/**
 * FeliCa プロトコル処理クラス
 */
export class FeliCaProtocol {
	constructor(usbManager, options = {}) {
		this.usbManager = usbManager;
		this.debug = options.debug ?? false;
		this.warning = options.warning ?? true;
		
		// エラーハンドラー
		this.errorHandler = new NFCErrorHandler({ debug: this.debug, warning: this.warning });
		
		// FeliCa設定
		this.config = {
			polling: false,
			IDm: null,
			PMm: null,
			SystemCode: null
		};
		
		// ログ設定
		this.log = this.debug ? console.log : () => {};
		this.processName = '';
	}

	/**
	 * FeliCa Lite-S カードポーリング
	 */
	async polling() {
		this.log('** FeliCaProtocol.polling: begin');
		this.processName = 'Polling FeliCa Lite-S';

		try {
			// ポーリングコマンド生成
			const pollingCommand = [...FELICA_COMMANDS.POLLING.BASE];
			pollingCommand[0] = pollingCommand.length; // Length設定

			this.log('polling: Generate Command:', NFCDataUtils.arrayToHexs(pollingCommand, ' '));

			// ポーリング実行
			const response = await this._manipulateCardErrorThru(pollingCommand, 100);
			
			this.config.polling = false;
			
			// カード未発見チェック
			if (response.CodeStatus2[0] === 2 && 
				response.CodeStatus2[1] === 100 && 
				response.CodeStatus2[2] === 1) {
				return { Error: { code: ERROR_CODES.POLLING_NO_CARD, message: '' } };
			}

			// レスポンスチェック
			const responseError = this._checkResponseData(response);
			this.errorHandler.handleError(responseError);

			// ポーリング結果処理
			const result = this._processPollingResponse(response.Data, pollingCommand);
			this.log('polling: result:', result);
			
			const pollingError = this._checkPollingResponseData(result);
			this.errorHandler.handleError(pollingError);

			this.config.polling = true;

			// USB設定コマンド実行
			await this._executePollingSetup();

			this.log('** FeliCaProtocol.polling: end', result);
			this.processName = '';
			return result;

		} catch (error) {
			this.processName = '';
			throw error;
		}
	}

	/**
	 * FeliCa Lite-S カード読み込み
	 */
	async read(options) {
		this.log('** FeliCaProtocol.read: begin');
		this.processName = 'Read FeliCa Lite-S';

		try {
			if (!this.config.polling) {
				return { Error: { code: ERROR_CODES.POLLING_NOT_DETECTED, message: '(Read)' } };
			}

			// 読み込みコマンド生成
			const readCommand = [...FELICA_COMMANDS.READ.BASE];
			
			// IDm設定
			NFCDataUtils.arrayCopy(readCommand, 2, this.config.IDm, 0, this.config.IDm.length);
			
			// ブロック情報追加
			readCommand.push(options.Block.length); // ブロック数
			for (const block of options.Block) {
				readCommand.push(FELICA_COMMANDS.READ.BLOCK_ACCESS_MODE);
				readCommand.push(block);
			}

			readCommand[0] = readCommand.length; // Length設定

			this.log('read: Generate Command:', NFCDataUtils.arrayToHexs(readCommand, ' '));

			// 読み込み実行
			const response = await this._manipulateCard(readCommand, 100);
			const result = this._processReadResponse(response.Data, readCommand);
			
			this.log('read: result:', result);
			
			const readError = this._checkReadResponseData(result);
			this.errorHandler.handleError(readError);

			this.log('** FeliCaProtocol.read: end');
			this.processName = '';
			return result;

		} catch (error) {
			this.processName = '';
			throw error;
		}
	}

	/**
	 * FeliCa Lite-S カード書き込み
	 */
	async write(options) {
		this.log('** FeliCaProtocol.write: begin');
		this.processName = 'Write FeliCa Lite-S';

		try {
			if (!this.config.polling) {
				this.log('write: Polling Error');
				return { Error: { code: ERROR_CODES.POLLING_NOT_DETECTED, message: '(Write)' } };
			}

			const responses = [];
			let responseCount = 0;

			for (const dataOption of options.Datas) {
				// 書き込みコマンド生成
				const writeCommand = [...FELICA_COMMANDS.WRITE.BASE];
				
				// IDm設定
				NFCDataUtils.arrayCopy(writeCommand, 2, this.config.IDm, 0, this.config.IDm.length);
				
				// ブロック情報追加
				writeCommand.push(FELICA_COMMANDS.WRITE.BLOCK_ACCESS_MODE);
				writeCommand.push(dataOption.Block);
				
				// データ追加（UTF-8対応、16バイト制限）
				const utf8Bytes = NFCDataUtils.stringToBytesUTF8(dataOption.Data, 16);
				
				// 16バイトまでパディング
				const paddedBytes = NFCDataUtils.padBytes(utf8Bytes, 16, 0x00);
				
				// バイト配列をコマンドに追加
				writeCommand.push(...paddedBytes);

				writeCommand[0] = writeCommand.length; // Length設定

				this.log('write: Generate Command:', NFCDataUtils.arrayToHexs(writeCommand, ' '));

				// 書き込み実行
				const response = await this._manipulateCard(writeCommand, 100);
				const result = this._processWriteResponse(response.Data, writeCommand);
				
				this.log('write: result:', result);
				
				const writeError = this._checkWriteResponseData(result);
				this.errorHandler.handleError(writeError);

				responses[responseCount] = result;
				responseCount++;
			}

			this.log('** FeliCaProtocol.write: end', responses);
			this.processName = '';
			return responses;

		} catch (error) {
			this.processName = '';
			throw error;
		}
	}

	/**
	 * カード操作（エラーチェック付き）
	 */
	async _manipulateCard(command, timeout) {
		this.log('manipulateCard: begin', NFCDataUtils.arrayToHexs(command));

		const response = await this._manipulateCardErrorThru(command, timeout);
		const responseError = this._checkResponseData(response);
		this.log('manipulateCard: ResponseErr', responseError);
		this.errorHandler.handleError(responseError);

		this.log('manipulateCard: end');
		return response;
	}

	/**
	 * カード操作（エラーチェックなし）
	 */
	async _manipulateCardErrorThru(command, timeout = 100) {
		this.log('manipulateCardErrorThru: begin', NFCDataUtils.arrayToHexs(command));

		// タイムアウトをマイクロ秒に変換
		const timeoutMicros = timeout * 1000;

		// コマンド構築
		const ccom = [];
		ccom.push(
			0x5f, 0x46, 0x04,
			timeoutMicros & 0xFF,
			(timeoutMicros >> 8) & 0xFF,
			(timeoutMicros >> 16) & 0xFF,
			(timeoutMicros >> 24) & 0xFF
		);
		ccom.push(
			0x95, 0x82,
			(command.length >> 8) & 0xFF,
			command.length & 0xFF
		);
		ccom.push(...command);

		this.log('manipulateCardErrorThru: Ccom', NFCDataUtils.arrayToHexs(ccom));

		// リクエストコマンド構築
		const rcom = [];
		rcom.push(
			0xff, 0x50, 0x00, 0x01, 0x00,
			(ccom.length >> 8) & 0xFF,
			ccom.length & 0xFF
		);
		rcom.push(...ccom);
		rcom.push(0x00, 0x00, 0x00);

		this.log('manipulateCardErrorThru: Rcom', NFCDataUtils.arrayToHexs(rcom));

		// USB転送実行
		const responseAll = await this.usbManager.escapeTransferTarget(rcom, 400);
		this.log('manipulateCardErrorThru: recv', NFCDataUtils.arrayToHexs(responseAll));

		// レスポンス分解
		const result = this._disassembleResponseData(responseAll);
		this.log('manipulateCardErrorThru: ResponseData', result);

		this.log('manipulateCardErrorThru: end');
		return result;
	}

	/**
	 * ポーリング後のUSB設定実行
	 */
	async _executePollingSetup() {
		const config = {};
		await this._executeControlCommands(USB_POLLING_COMMANDS, config);
		this.usbManager.config.Polling = config;
	}

	/**
	 * 制御コマンド実行
	 */
	async _executeControlCommands(commands, resultContainer) {
		for (const [key, command] of Object.entries(commands)) {
			this.log(`*--* ${key}: Start`);
			
			const response = await this.usbManager.escapeTransferTarget(command.Com, 400);
			resultContainer[key] = NFCDataUtils.arraySlice(response, 0, response.length - 2);
			
			this.log(`*--* ${key}: End`, NFCDataUtils.arrayToHexs(resultContainer[key]));
			
			if (command.Sleep > 0) {
				await NFCDataUtils.sleep(command.Sleep);
			}
		}
	}

	/**
	 * ポーリングレスポンス処理
	 */
	_processPollingResponse(responseData, command) {
		const result = {
			Error: false,
			Id: +NFCDataUtils.arraySlice(responseData, 0, 1),
			ResponseCode: +NFCDataUtils.arraySlice(responseData, 1, 1),
			IDm: NFCDataUtils.arraySlice(responseData, 2, 8),
			PMm: NFCDataUtils.arraySlice(responseData, 10, 8),
			SystemCode: NFCDataUtils.arraySlice(responseData, 18, 2),
			Status1: 0,
			Status2: 0,
			Command: command,
			CommandString: NFCDataUtils.arrayToHexs(command),
			Response: responseData,
			ResponseString: NFCDataUtils.arrayToHexs(responseData)
		};

		result.IDmString = NFCDataUtils.arrayToHexs(result.IDm);
		result.PMmString = NFCDataUtils.arrayToHexs(result.PMm);
		result.SystemCodeString = NFCDataUtils.arrayToHexs(result.SystemCode);

		// FeliCa設定更新
		this.config.IDm = result.IDm;
		this.config.PMm = result.PMm;
		this.config.SystemCode = result.SystemCode;

		return result;
	}

	/**
	 * 読み込みレスポンス処理
	 */
	_processReadResponse(responseData, command) {
		const result = {
			Error: false,
			Id: +NFCDataUtils.arraySlice(responseData, 0, 1),
			ResponseCode: +NFCDataUtils.arraySlice(responseData, 1, 1),
			IDm: NFCDataUtils.arraySlice(responseData, 2, 8),
			Status1: +NFCDataUtils.arraySlice(responseData, 10, 1),
			Status2: +NFCDataUtils.arraySlice(responseData, 11, 1),
			BlockCount: +NFCDataUtils.arraySlice(responseData, 12, 1),
			Data: NFCDataUtils.arraySlice(responseData, 13, responseData.length - 13),
			Command: command,
			CommandString: NFCDataUtils.arrayToHexs(command),
			Response: responseData,
			ResponseString: NFCDataUtils.arrayToHexs(responseData)
		};

		result.IDmString = NFCDataUtils.arrayToHexs(result.IDm);
		result.DataString = '';
		result.Datas = [];
		result.DatasString = [];

		// ブロックデータ分割（UTF-8対応）
		for (let i = 0, offset = 13, blockLength = 16; i < result.BlockCount; i++, offset += blockLength) {
			result.Datas[i] = NFCDataUtils.arraySlice(responseData, offset, blockLength);
			
			// UTF-8対応の文字列変換を試行、失敗時は従来方式にフォールバック
			try {
				result.DatasString[i] = NFCDataUtils.binToStringUTF8(result.Datas[i]);
			} catch (error) {
				result.DatasString[i] = NFCDataUtils.binToString(result.Datas[i]);
				result.DatasString[i] = result.DatasString[i].trim(' ');
			}
		}
		result.DataString = result.DatasString.toString();

		return result;
	}

	/**
	 * 書き込みレスポンス処理
	 */
	_processWriteResponse(responseData, command) {
		const result = {
			Error: false,
			Id: +NFCDataUtils.arraySlice(responseData, 0, 1),
			ResponseCode: +NFCDataUtils.arraySlice(responseData, 1, 1),
			IDm: NFCDataUtils.arraySlice(responseData, 2, 8),
			Status1: +NFCDataUtils.arraySlice(responseData, 10, 1),
			Status2: +NFCDataUtils.arraySlice(responseData, 11, 1),
			Command: command,
			CommandString: NFCDataUtils.arrayToHexs(command),
			Response: responseData,
			ResponseString: NFCDataUtils.arrayToHexs(responseData)
		};

		result.IDmString = NFCDataUtils.arrayToHexs(result.IDm);
		return result;
	}

	/**
	 * レスポンスデータ分解
	 */
	_disassembleResponseData(responseData) {
		const result = {
			Code: 0,
			CodeStatus1: 0,
			CodeStatus2: [0, 0, 0],
			Status92: 0,
			Status96: 0,
			Length: 0,
			Status1: 0,
			Status2: 0,
			Data: []
		};

		const statusBytes = responseData.slice(responseData.length - 2);
		result.AllData = responseData;
		result.Status1 = statusBytes[0];
		result.Status2 = statusBytes[1];

		// 各ステータス情報の抽出
		let index = responseData.indexOf(0xc0);
		if (index >= 0) {
			result.Code = responseData[index];
			result.CodeStatus1 = responseData[index + 1];
			result.CodeStatus2 = NFCDataUtils.arraySlice(responseData, index + 2, 3);
		}

		index = responseData.indexOf(0x92);
		if (index >= 0) {
			result.Status92 = responseData[index + 1];
		}

		index = responseData.indexOf(0x96);
		if (index >= 0) {
			result.Status96 = responseData[index + 1];
		}

		// レスポンスデータ長の取得
		index = responseData.indexOf(0x97);
		if (index >= 0) {
			let pos = index + 1;
			result.Length = responseData[pos];

			if (result.Length >= 128) {
				switch (result.Length) {
					case 129:
						result.Length = responseData[pos + 1];
						pos += 1;
						break;
					case 130:
						result.Length = (responseData[pos + 1] << 8) + responseData[pos + 2];
						pos += 2;
						break;
					case 131:
						result.Length = (responseData[pos + 1] << 16) + (responseData[pos + 2] << 8) + responseData[pos + 3];
						pos += 3;
						break;
					case 132:
						result.Length = (responseData[pos + 1] << 24) + (responseData[pos + 2] << 16) + (responseData[pos + 3] << 8) + responseData[pos + 4];
						pos += 4;
						break;
					default:
						result.Length = -1;
				}
			}

			if (result.Length > 0) {
				result.Data = NFCDataUtils.arraySlice(responseData, pos + 1, result.Length);
			}
		}

		return result;
	}

	/**
	 * レスポンスデータチェック
	 */
	_checkResponseData(responseObj) {
		// レスポンスヘッダーチェック
		if (responseObj.Status1 !== 0x90 || responseObj.Status2 !== 0) {
			return {
				code: ERROR_CODES.RESPONSE_STATUS_ERROR,
				message: NFCDataUtils.bytesToHexs([responseObj.Status1, responseObj.Status2])
			};
		}
		if (responseObj.CodeStatus1 !== 0x03) {
			return {
				code: ERROR_CODES.RESPONSE_CODE_ERROR_C003,
				message: NFCDataUtils.bytesToHexs([responseObj.CodeStatus1])
			};
		}
		if (responseObj.CodeStatus2[0] !== 0x00 || responseObj.CodeStatus2[1] !== 0x90 || responseObj.CodeStatus2[2] !== 0x00) {
			return {
				code: ERROR_CODES.RESPONSE_CODE_ERROR_009000,
				message: NFCDataUtils.bytesToHexs(responseObj.CodeStatus2)
			};
		}

		// レスポンスデータ長チェック
		if (responseObj.Length < 0) {
			return { code: ERROR_CODES.RESPONSE_LENGTH_SIZE_ERROR, message: '' };
		}
		if (responseObj.Length > responseObj.Data.length) {
			return {
				code: ERROR_CODES.RESPONSE_LENGTH_MISMATCH,
				message: `取得データ長[${responseObj.Length}]:実データ長[${responseObj.Data.length}]`
			};
		}

		return false; // エラーなし
	}

	/**
	 * ポーリングレスポンスチェック
	 */
	_checkPollingResponseData(responseObj) {
		if (responseObj.ResponseCode !== RESPONSE_CODES.POLLING) {
			return {
				code: ERROR_CODES.POLLING_RESPONSE_CODE_ERROR,
				message: NFCDataUtils.bytesToHexs([responseObj.ResponseCode])
			};
		}
		return false; // エラーなし
	}

	/**
	 * 読み込みレスポンスチェック
	 */
	_checkReadResponseData(responseObj) {
		if (responseObj.ResponseCode !== RESPONSE_CODES.READ) {
			return {
				code: ERROR_CODES.READ_RESPONSE_CODE_ERROR,
				message: NFCDataUtils.bytesToHexs([responseObj.ResponseCode])
			};
		}
		if (responseObj.Status2 === 0x70) {
			return {
				code: ERROR_CODES.READ_MEMORY_FATAL_ERROR,
				message: NFCDataUtils.bytesToHexs([responseObj.Status1, responseObj.Status2])
			};
		}
		if (responseObj.Status1 !== 0x00 || responseObj.Status2 !== 0x00) {
			return {
				code: ERROR_CODES.READ_ERROR,
				message: NFCDataUtils.bytesToHexs([responseObj.Status1, responseObj.Status2])
			};
		}
		return false; // エラーなし
	}

	/**
	 * 書き込みレスポンスチェック
	 */
	_checkWriteResponseData(responseObj) {
		if (responseObj.ResponseCode !== RESPONSE_CODES.WRITE) {
			return {
				code: ERROR_CODES.WRITE_RESPONSE_CODE_ERROR,
				message: NFCDataUtils.bytesToHexs([responseObj.ResponseCode])
			};
		}
		if (responseObj.Status2 === 0x70) {
			return {
				code: ERROR_CODES.WRITE_MEMORY_FATAL_ERROR,
				message: NFCDataUtils.bytesToHexs([responseObj.Status1, responseObj.Status2])
			};
		}
		if (responseObj.Status2 === 0x71) {
			return {
				code: ERROR_CODES.MEMORY_WRITE_LIMIT,
				message: NFCDataUtils.bytesToHexs([responseObj.Status1, responseObj.Status2])
			};
		}
		if (responseObj.Status1 !== 0x00 || responseObj.Status2 !== 0x00) {
			return {
				code: ERROR_CODES.WRITE_ERROR,
				message: NFCDataUtils.bytesToHexs([responseObj.Status1, responseObj.Status2])
			};
		}
		return false; // エラーなし
	}
}