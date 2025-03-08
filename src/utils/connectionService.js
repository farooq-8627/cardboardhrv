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
	onDisconnect,
} from "firebase/database";

// Firebase configuration - using a public Firebase project
const firebaseConfig = {
	apiKey: "AIzaSyBXQZx1WXP9-ZdKUU9nENGY0q9P2sCfKxE",
	authDomain: "cardboardhrv-public.firebaseapp.com",
	databaseURL: "https://cardboardhrv-public-default-rtdb.firebaseio.com",
	projectId: "cardboardhrv-public",
	storageBucket: "cardboardhrv-public.appspot.com",
	messagingSenderId: "1082669024548",
	appId: "1:1082669024548:web:3a5e9d8e9f9f9f9f9f9f9f",
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
			// Create session reference
			const sessionRef = ref(database, `sessions/${sessionId}`);

			// Initialize session if it doesn't exist
			onValue(
				sessionRef,
				(snapshot) => {
					if (!snapshot.exists()) {
						set(sessionRef, {
							created: Date.now(),
							lastUpdated: Date.now(),
						});
					}
				},
				{ onlyOnce: true }
			);

			// Register this device
			await this.registerDevice();

			// Set up listeners for connection changes
			this.setupConnectionListeners();

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

	setupConnectionListeners() {
		// Set up listeners for session data
		const sessionRef = ref(database, `sessions/${this.sessionId}`);

		// Listen for device changes
		const devicesRef = ref(database, `sessions/${this.sessionId}/devices`);
		onValue(devicesRef, (snapshot) => {
			const devices = snapshot.val();
			this.log("Devices updated:", devices);

			if (!devices) return;

			// Convert to array
			const deviceArray = Object.values(devices);

			// Check if both device types are present
			const mobileDevice = deviceArray.find((d) => d.deviceType === "mobile");
			const desktopDevice = deviceArray.find((d) => d.deviceType === "desktop");

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
			} else if (this.connectionStatus === "connected") {
				// One device disconnected
				this.connectionStatus = "connecting";
				this.pairedDeviceId = null;

				this.emit(EVENT_TYPES.CONNECTION_STATUS_CHANGED, {
					status: this.connectionStatus,
					sessionId: this.sessionId,
				});

				this.emit(EVENT_TYPES.DEVICE_DISCONNECTED, {
					sessionId: this.sessionId,
					timestamp: Date.now(),
				});

				this.log("Device disconnected, waiting for reconnection");
			}
		});

		// Listen for heart rate data (only on desktop)
		if (this.deviceType === "desktop") {
			const heartRateRef = ref(
				database,
				`sessions/${this.sessionId}/heartRateData`
			);
			onValue(heartRateRef, (snapshot) => {
				const data = snapshot.val();
				if (data) {
					this.log("Heart rate data received:", data);
					this.emit(EVENT_TYPES.HEART_RATE_DATA, data);
				}
			});
		}

		// Listen for messages
		const messagesRef = ref(database, `sessions/${this.sessionId}/messages`);
		onValue(messagesRef, (snapshot) => {
			const messages = snapshot.val();
			if (!messages) return;

			// Get the latest message
			const messageArray = Object.values(messages);
			const latestMessage = messageArray[messageArray.length - 1];

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
					this.log("Message received:", latestMessage);
					this.emit(EVENT_TYPES.MESSAGE, {
						text: latestMessage.text,
						fromDeviceId: latestMessage.fromDeviceId,
						timestamp: latestMessage.timestamp,
					});
				}
			}
		});

		this.log("Connection listeners set up");
	}

	async registerDevice() {
		this.log("Registering device:", this.deviceId, this.deviceType);

		try {
			// Register this device in the session
			const deviceRef = ref(
				database,
				`sessions/${this.sessionId}/devices/${this.deviceId}`
			);

			// Set device data
			await set(deviceRef, {
				deviceId: this.deviceId,
				deviceType: this.deviceType,
				lastSeen: Date.now(),
				userAgent: navigator.userAgent,
				connectionStatus: "online",
			});

			// Set up presence system
			const connectedRef = ref(database, ".info/connected");
			onValue(connectedRef, (snapshot) => {
				if (snapshot.val() === true) {
					// We're connected to Firebase

					// When this client disconnects, update the device status
					onDisconnect(deviceRef).update({
						connectionStatus: "offline",
						lastSeen: Date.now(),
					});

					// After disconnect, remove the device after a delay
					onDisconnect(deviceRef).remove();

					// Update the device status to online
					update(deviceRef, {
						connectionStatus: "online",
						lastSeen: Date.now(),
					});

					this.log("Device registered with presence system");
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

				// Remove the device from the session
				await remove(deviceRef);
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
