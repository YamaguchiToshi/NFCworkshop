/*
*
*	JavaScript FeliCa Lite-S 操作モジュール
*		SimpleNFC.js
*		import { SimpleNFC } from './modules/SimpleNFC.js';
*	メンテナンス履歴
*		2025/01/06 Ver.1.0.0 SimpleNFC初期バージョン - モジュール化されたシンプルNFC操作API
*
*******************************************************************/

import { USBDeviceManager } from './USBDeviceManager.js';
import { FeliCaProtocol } from './FeliCaProtocol.js';
import { NFCErrorHandler, ERROR_CODES, ERROR_MESSAGES } from './NFCErrors.js';
import { NFCDataUtils } from './NFCDataUtils.js';

/**
 * SimpleNFC メインクラス（ファサードパターン）
 * シンプルで使いやすいNFC操作APIを提供
 * FeliCa Lite-SカードのWebUSB経由での読み書き、UTF-8日本語対応
 */
class SimpleNFC {

	// エラー定数
	static Errors = ERROR_MESSAGES;

	constructor(options = {}) {
		// 設定値
		this.WARNING = options?.warning ?? true;
		this.DEBUG = options?.debug ?? false;
		
		
		// モジュール化されたコンポーネント
		this.usbManager = new USBDeviceManager({
			debug: this.DEBUG,
			warning: this.WARNING
		});
		
		this.felicaProtocol = new FeliCaProtocol(this.usbManager, {
			debug: this.DEBUG,
			warning: this.WARNING
		});
		
		this.errorHandler = new NFCErrorHandler({
			debug: this.DEBUG,
			warning: this.WARNING
		});

		// ログ設定
		this.log = this.DEBUG ? console.log : () => {};
		this.error = console.error;
		this.warn = this.WARNING ? console.log : () => {};
	}

	/**
	 * USBデバイス(カードリーダー)コネクト
	 */
	async connectUSBDevice() {
		return await this.usbManager.connect();
	}

	/**
	 * USBデバイス(カードリーダー) Endpoint の取得
	 */
	getEndPoint(direction) {
		return this.usbManager.getEndpoint(direction);
	}

	/**
	 * USBデバイス(カードリーダー)オープン
	 */
	async openUSBDevice() {
		return await this.usbManager.open();
	}

	async contrlCommUSBDevice(commands, results) {
		// 後方互換性のため、USBDeviceManagerの内部メソッドを呼び出し
		await this.usbManager._executeControlCommands(commands, results);
	}

	/**
	 * USBデバイス(カードリーダー)クローズ
	 */
	async closeUSBDevice() {
		return await this.usbManager.close();
	}

	/**
	 * FeliCa カードのポーリング
	 */
	async pollingLiteS() {
		return await this.felicaProtocol.polling();
	}

	/**
	 * FeliCa Lite-S カードの読み込み
	 */
	async readLiteS(options) {
		return await this.felicaProtocol.read(options);
	}

	/**
	 * FeliCa Lite-S カードの書き込み
	 */
	async writeLiteS(options) {
		return await this.felicaProtocol.write(options);
	}

	// ========================================
	// ユーティリティメソッド（推奨）
	// ========================================

	/**
	 * エラーメッセージの取得
	 */
	getErrorMessage(errorCode) {
		return this.errorHandler.getErrorMessage(errorCode);
	}

	/**
	 * エラーの処理
	 */
	handleError(error) {
		return this.errorHandler.handleError(error);
	}

	/**
	 * UTF-8対応バイナリデータを文字列に変換
	 */
	binToStringUTF8(data) {
		return NFCDataUtils.binToStringUTF8(data);
	}

	/**
	 * 文字列をUTF-8バイト配列に変換
	 */
	stringToBytesUTF8(str, maxBytes = 16) {
		return NFCDataUtils.stringToBytesUTF8(str, maxBytes);
	}

	/**
	 * 文字列のUTF-8バイト長を取得
	 */
	getUTF8ByteLength(str) {
		return NFCDataUtils.getUTF8ByteLength(str);
	}

	/**
	 * 指定バイト数に文字列を切り詰める
	 */
	truncateStringToBytes(str, maxBytes = 16) {
		return NFCDataUtils.truncateStringToBytes(str, maxBytes);
	}

	/**
	 * スリープ処理
	 */
	async sleep(milliseconds) {
		return NFCDataUtils.sleep(milliseconds);
	}
}

export { SimpleNFC };