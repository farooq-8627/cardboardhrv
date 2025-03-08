/**
 * Connection Service
 *
 * This service uses Firebase Realtime Database for reliable cross-device communication.
 * It provides a simple API for connecting devices and sharing data between them.
 */

import { initializeApp } from "firebase/app";
import {
	getDatabase,
	ref,
	set,
	onValue,
	update,
	remove,
} from "firebase/database";

// Firebase configuration
const firebaseConfig = {
	apiKey: "AIzaSyDQzEMQtT9afQiMlK-31GxJst9iqK4_8Gg",
	authDomain: "cardboardhrv.firebaseapp.com",
	databaseURL: "https://cardboardhrv-default-rtdb.firebaseio.com",
	projectId: "cardboardhrv",
	storageBucket: "cardboardhrv.appspot.com",
	messagingSenderId: "1098040621778",
	appId: "1:1098040621778:web:5f9e3a5f1c9b5e5e5e5e5e",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Event types
const EVENT_TYPES = {
	CONNECTION_STATUS_CHANGED: "connectionStatusChanged",
	DEVICES_PAIRED: "devicesPaired",
	DEVICE_DISCONNECTED: "deviceDisconnected",
	HEART_RATE_DATA: "heartRateData",
	MESSAGE: "message",
};

class ConnectionService {
	constructor() {
		this.sessionId = null;
		this.deviceType = null; // 'mobile' or 'desktop'
		this.deviceId = this.generateDeviceId();
		this.isInitialized = false;
		this.connectionStatus = "disconnected";
		this.pairedDeviceId = null;
		this.eventListeners = {
			[EVENT_TYPES.CONNECTION_STATUS_CHANGED]: [],
			[EVENT_TYPES.DEVICES_PAIRED]: [],
			[EVENT_TYPES.DEVICE_DISCONNECTED]: [],
			[EVENT_TYPES.HEART_RATE_DATA]: [],
			[EVENT_TYPES.MESSAGE]: [],
		};

		// Debug flag
		this.debug = true;
	}

	async initialize(sessionId, deviceType) {
		if (!sessionId) {
			console.error("Session ID is required");
			return false;
		}

		if (deviceType !== "mobile" && deviceType !== "desktop") {
			console.error('Device type must be either "mobile" or "desktop"');
			return false;
		}

		this.sessionId = sessionId;
		this.deviceType = deviceType;

		this.log(
			`Initializing connection service for session ${sessionId} as ${deviceType}`
		);

		try {
			// Set up connection in Firebase
			const sessionRef = ref(database, `sessions/${sessionId}`);

			// Set up listeners for connection changes
			this.setupConnectionListeners(database);

			// Register this device
			await this.registerDevice();

			// Set up localStorage fallback for testing on the same device
			this.setupLocalStorageFallback();

			this.isInitialized = true;
			this.connectionStatus = "connecting";

			// Emit connection status change
			this.emit(EVENT_TYPES.CONNECTION_STATUS_CHANGED, {
				status: this.connectionStatus,
				sessionId: this.sessionId,
				deviceType: this.deviceType,
				deviceId: this.deviceId,
			});

			this.log("Connection service initialized successfully");
			return true;
		} catch (error) {
			console.error("Error initializing connection service:", error);
			return false;
		}
	}

	setupLocalStorageFallback() {
		// This is a fallback mechanism for testing on the same device
		// It uses localStorage to communicate between tabs

		// Listen for storage events
		window.addEventListener("storage", (event) => {
			if (event.key === `cardboardhrv-${this.sessionId}`) {
				try {
					const data = JSON.parse(event.newValue);
					if (data && data.type) {
						this.handleDataUpdate(data);
					}
				} catch (error) {
					console.error("Error parsing localStorage data:", error);
				}
			}
		});

		this.log("Local storage fallback set up");
	}

	setupConnectionListeners(firebaseDatabase) {
		// Set up listeners for session data
		const sessionRef = ref(firebaseDatabase, `sessions/${this.sessionId}`);

		onValue(sessionRef, (snapshot) => {
			const data = snapshot.val();
			this.log("Session data updated:", data);

			if (!data) {
				// Session doesn't exist yet, create it
				set(sessionRef, {
					created: Date.now(),
					lastUpdated: Date.now(),
				});
				return;
			}

			// Check if both devices are connected
			if (data.devices) {
				const devices = Object.values(data.devices);
				const mobileDevice = devices.find((d) => d.deviceType === "mobile");
				const desktopDevice = devices.find((d) => d.deviceType === "desktop");

				if (mobileDevice && desktopDevice) {
					// Both devices are connected, emit paired event if not already paired
					if (this.connectionStatus !== "connected") {
						this.connectionStatus = "connected";
						this.pairedDeviceId =
							this.deviceType === "mobile"
								? desktopDevice.deviceId
								: mobileDevice.deviceId;

						this.emit(EVENT_TYPES.CONNECTION_STATUS_CHANGED, {
							status: this.connectionStatus,
							sessionId: this.sessionId,
						});

						this.emit(EVENT_TYPES.DEVICES_PAIRED, {
							sessionId: this.sessionId,
							mobileDeviceId: mobileDevice.deviceId,
							desktopDeviceId: desktopDevice.deviceId,
							timestamp: Date.now(),
						});

						this.log(
							"Devices paired:",
							mobileDevice.deviceId,
							desktopDevice.deviceId
						);
					}
				}
			}

			// Check for heart rate data
			if (data.heartRateData && this.deviceType === "desktop") {
				const latestData = data.heartRateData;
				this.emit(EVENT_TYPES.HEART_RATE_DATA, latestData);
			}

			// Check for messages
			if (data.messages) {
				const messages = Object.values(data.messages);
				const latestMessage = messages[messages.length - 1];

				if (
					latestMessage &&
					latestMessage.timestamp > (this.lastMessageTimestamp || 0)
				) {
					this.lastMessageTimestamp = latestMessage.timestamp;

					// Only process messages intended for this device or broadcast messages
					if (
						!latestMessage.targetDeviceId ||
						latestMessage.targetDeviceId === this.deviceId
					) {
						this.emit(EVENT_TYPES.MESSAGE, {
							text: latestMessage.text,
							fromDeviceId: latestMessage.fromDeviceId,
							timestamp: latestMessage.timestamp,
						});
					}
				}
			}
		});

		this.log("Connection listeners set up");
	}

	handleDataUpdate(data) {
		this.log("Handling data update:", data);

		switch (data.type) {
			case "heartRateData":
				if (this.deviceType === "desktop") {
					this.emit(EVENT_TYPES.HEART_RATE_DATA, data);
				}
				break;

			case "message":
				this.emit(EVENT_TYPES.MESSAGE, {
					text: data.text,
					fromDeviceId: data.fromDeviceId,
					timestamp: data.timestamp,
				});
				break;

			case "connectionStatus":
				if (data.status === "disconnected" && data.deviceId !== this.deviceId) {
					// The other device disconnected
					this.connectionStatus = "disconnected";
					this.pairedDeviceId = null;

					this.emit(EVENT_TYPES.CONNECTION_STATUS_CHANGED, {
						status: this.connectionStatus,
						sessionId: this.sessionId,
					});

					this.emit(EVENT_TYPES.DEVICE_DISCONNECTED, {
						deviceId: data.deviceId,
						timestamp: data.timestamp,
					});
				} else if (
					data.status === "connecting" &&
					data.deviceId !== this.deviceId
				) {
					// The other device is trying to connect
					this.log("Other device is connecting:", data.deviceId);
				}
				break;

			default:
				this.log("Unknown data type:", data.type);
		}
	}

	async registerDevice() {
		this.log("Registering device:", this.deviceId, this.deviceType);

		try {
			// Register this device in the session
			const deviceRef = ref(
				database,
				`sessions/${this.sessionId}/devices/${this.deviceId}`
			);

			await set(deviceRef, {
				deviceId: this.deviceId,
				deviceType: this.deviceType,
				lastSeen: Date.now(),
				userAgent: navigator.userAgent,
				connectionStatus: "online",
			});

			// Set up a presence system to detect when devices go offline
			const connectedRef = ref(database, ".info/connected");

			onValue(connectedRef, (snapshot) => {
				if (snapshot.val() === true) {
					// We're connected to Firebase

					// When this client disconnects, remove the device
					const deviceStatusRef = ref(
						database,
						`sessions/${this.sessionId}/devices/${this.deviceId}/connectionStatus`
					);

					// Set the device status to 'offline' when the client disconnects
					update(deviceRef, {
						lastSeen: Date.now(),
						connectionStatus: "online",
					});

					// Set up a disconnect handler
					onValue(deviceStatusRef, () => {
						update(deviceRef, {
							lastSeen: Date.now(),
							connectionStatus: "online",
						});
					});
				}
			});

			this.log("Device registered successfully");
			return true;
		} catch (error) {
			console.error("Error registering device:", error);
			return false;
		}
	}

	async sendHeartRateData(data) {
		if (!this.isInitialized) {
			console.error("Connection service not initialized");
			return false;
		}

		if (this.deviceType !== "mobile") {
			console.error("Only mobile devices can send heart rate data");
			return false;
		}

		try {
			// Send heart rate data to Firebase
			const heartRateRef = ref(
				database,
				`sessions/${this.sessionId}/heartRateData`
			);

			const heartRateData = {
				heartRate: data.heartRate,
				timestamp: data.timestamp || Date.now(),
				rawData: data.rawData,
				deviceId: this.deviceId,
			};

			await set(heartRateRef, heartRateData);

			// Also use localStorage as a fallback
			try {
				localStorage.setItem(
					`cardboardhrv-${this.sessionId}`,
					JSON.stringify({
						type: "heartRateData",
						...heartRateData,
					})
				);

				// Dispatch a storage event to notify other tabs
				window.dispatchEvent(
					new StorageEvent("storage", {
						key: `cardboardhrv-${this.sessionId}`,
						newValue: JSON.stringify({
							type: "heartRateData",
							...heartRateData,
						}),
					})
				);
			} catch (e) {
				console.error("Failed to use localStorage for heart rate data:", e);
			}

			this.log("Heart rate data sent:", heartRateData);
			return true;
		} catch (error) {
			console.error("Error sending heart rate data:", error);
			return false;
		}
	}

	async sendMessage(message) {
		if (!this.isInitialized) {
			console.error("Connection service not initialized");
			return false;
		}

		try {
			// Generate a unique message ID
			const messageId = `${Date.now()}-${Math.random()
				.toString(36)
				.substring(2, 9)}`;

			// Send message to Firebase
			const messageRef = ref(
				database,
				`sessions/${this.sessionId}/messages/${messageId}`
			);

			const messageData = {
				text: message,
				fromDeviceId: this.deviceId,
				fromDeviceType: this.deviceType,
				timestamp: Date.now(),
				// If we have a paired device, target the message to that device
				targetDeviceId: this.pairedDeviceId || null,
			};

			await set(messageRef, messageData);

			// Also use localStorage as a fallback
			try {
				localStorage.setItem(
					`cardboardhrv-${this.sessionId}`,
					JSON.stringify({
						type: "message",
						...messageData,
					})
				);

				// Dispatch a storage event to notify other tabs
				window.dispatchEvent(
					new StorageEvent("storage", {
						key: `cardboardhrv-${this.sessionId}`,
						newValue: JSON.stringify({
							type: "message",
							...messageData,
						}),
					})
				);
			} catch (e) {
				console.error("Failed to use localStorage for message:", e);
			}

			this.log("Message sent:", messageData);
			return true;
		} catch (error) {
			console.error("Error sending message:", error);
			return false;
		}
	}

	areBothDevicesConnected() {
		return (
			this.connectionStatus === "connected" && this.pairedDeviceId !== null
		);
	}

	on(event, callback) {
		if (!this.eventListeners[event]) {
			this.eventListeners[event] = [];
		}

		this.eventListeners[event].push(callback);
		this.log(
			`Added listener for ${event}, total listeners: ${this.eventListeners[event].length}`
		);

		return () => this.off(event, callback);
	}

	off(event, callback) {
		if (!this.eventListeners[event]) {
			return;
		}

		this.eventListeners[event] = this.eventListeners[event].filter(
			(cb) => cb !== callback
		);
		this.log(
			`Removed listener for ${event}, remaining listeners: ${this.eventListeners[event].length}`
		);
	}

	emit(event, data) {
		if (!this.eventListeners[event]) {
			return;
		}

		this.log(`Emitting ${event} with data:`, data);

		this.eventListeners[event].forEach((callback) => {
			try {
				callback(data);
			} catch (error) {
				console.error(`Error in ${event} listener:`, error);
			}
		});
	}

	async disconnect() {
		if (!this.isInitialized) {
			return;
		}

		this.log("Disconnecting from session:", this.sessionId);

		try {
			// Update device status
			if (this.sessionId && this.deviceId) {
				const deviceRef = ref(
					database,
					`sessions/${this.sessionId}/devices/${this.deviceId}`
				);
				await update(deviceRef, {
					lastSeen: Date.now(),
					connectionStatus: "offline",
				});

				// After a delay, remove the device from the session
				setTimeout(async () => {
					try {
						await remove(deviceRef);
					} catch (e) {
						console.error("Error removing device from session:", e);
					}
				}, 1000);
			}

			// Reset state
			this.connectionStatus = "disconnected";
			this.pairedDeviceId = null;
			this.isInitialized = false;

			// Emit disconnection event
			this.emit(EVENT_TYPES.CONNECTION_STATUS_CHANGED, {
				status: "disconnected",
				sessionId: this.sessionId,
				deviceId: this.deviceId,
				timestamp: Date.now(),
			});

			this.log("Disconnected from session");
			return true;
		} catch (error) {
			console.error("Error disconnecting from session:", error);
			return false;
		}
	}

	generateDeviceId() {
		// Try to get existing device ID from localStorage
		try {
			const storedDeviceId = localStorage.getItem("cardboardhrv-device-id");
			if (storedDeviceId) {
				return storedDeviceId;
			}
		} catch (e) {
			console.error("Failed to retrieve device ID from localStorage:", e);
		}

		// Generate a new device ID
		const deviceId = `${Date.now()}-${Math.random()
			.toString(36)
			.substring(2, 9)}`;

		// Store it in localStorage for future use
		try {
			localStorage.setItem("cardboardhrv-device-id", deviceId);
		} catch (e) {
			console.error("Failed to store device ID in localStorage:", e);
		}

		return deviceId;
	}

	log(...args) {
		if (this.debug) {
			console.log(`[ConnectionService]`, ...args);
		}
	}
}

// Create a singleton instance
const connectionService = new ConnectionService();

export default connectionService;
