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

// Firebase configuration - using the user's specific database
const firebaseConfig = {
	apiKey: "AIzaSyDQzEMQtT9afQiMlK-31GxJst9iqK4_8Gg",
	authDomain: "cardboardhrv.firebaseapp.com",
	databaseURL:
		"https://cardboardhrv-default-rtdb.asia-southeast1.firebasedatabase.app",
	projectId: "cardboardhrv",
	storageBucket: "cardboardhrv.appspot.com",
	messagingSenderId: "1098040621778",
	appId: "1:1098040621778:web:5f9e3a5f1c9b5e5e5e5e5e",
};

// Initialize Firebase with error handling
let app;
let database;
let firebaseAvailable = false;

try {
	app = initializeApp(firebaseConfig);
	database = getDatabase(app);
	firebaseAvailable = true;
	console.log("Firebase initialized successfully");
} catch (error) {
	console.error("Error initializing Firebase:", error);
	firebaseAvailable = false;
}

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

		// Direct connection flag
		this.useDirectConnection = !firebaseAvailable;

		// Set up direct connection listeners
		this.setupDirectConnectionListeners();
	}

	// Set up direct connection listeners using window.postMessage
	setupDirectConnectionListeners() {
		// Listen for messages from other windows/tabs
		window.addEventListener("message", (event) => {
			// Only process messages from our own origin
			if (event.origin !== window.location.origin) return;

			const data = event.data;
			if (!data || !data.type || !data.sessionId) return;

			// Only process messages for our session
			if (this.sessionId && data.sessionId !== this.sessionId) return;

			this.log("Direct connection message received:", data);

			switch (data.type) {
				case "heartRateData":
					if (this.deviceType === "desktop") {
						this.emit(EVENT_TYPES.HEART_RATE_DATA, data);
					}
					break;

				case "deviceConnected":
					if (data.deviceType !== this.deviceType) {
						this.pairedDeviceId = data.deviceId;
						this.connectionStatus = "connected";

						this.emit(EVENT_TYPES.CONNECTION_STATUS_CHANGED, {
							status: this.connectionStatus,
							sessionId: this.sessionId,
						});

						this.emit(EVENT_TYPES.DEVICES_PAIRED, {
							sessionId: this.sessionId,
							mobileDeviceId:
								this.deviceType === "mobile" ? this.deviceId : data.deviceId,
							desktopDeviceId:
								this.deviceType === "desktop" ? this.deviceId : data.deviceId,
							timestamp: Date.now(),
						});

						// Send a response to confirm the connection
						this.sendDirectMessage({
							type: "connectionConfirmed",
							sessionId: this.sessionId,
							deviceId: this.deviceId,
							deviceType: this.deviceType,
							timestamp: Date.now(),
						});
					}
					break;

				case "connectionConfirmed":
					if (data.deviceType !== this.deviceType) {
						this.pairedDeviceId = data.deviceId;
						this.connectionStatus = "connected";

						this.emit(EVENT_TYPES.CONNECTION_STATUS_CHANGED, {
							status: this.connectionStatus,
							sessionId: this.sessionId,
						});
					}
					break;

				case "message":
					this.emit(EVENT_TYPES.MESSAGE, {
						text: data.text,
						fromDeviceId: data.deviceId,
						timestamp: data.timestamp,
					});
					break;
			}
		});

		this.log("Direct connection listeners set up");
	}

	// Send a message using the direct connection
	sendDirectMessage(data) {
		// Try to send to all open windows
		try {
			// Send to parent window if we're in an iframe
			if (window.parent && window.parent !== window) {
				window.parent.postMessage(data, window.location.origin);
			}

			// Send to opener window if we were opened by another window
			if (window.opener && !window.opener.closed) {
				window.opener.postMessage(data, window.location.origin);
			}

			// Broadcast to all windows using localStorage as a communication channel
			localStorage.setItem(
				"cardboardhrv-broadcast",
				JSON.stringify({
					...data,
					timestamp: Date.now(),
				})
			);

			// Dispatch a storage event to notify other tabs
			window.dispatchEvent(
				new StorageEvent("storage", {
					key: "cardboardhrv-broadcast",
					newValue: JSON.stringify({
						...data,
						timestamp: Date.now(),
					}),
				})
			);

			this.log("Direct message sent:", data);
		} catch (error) {
			console.error("Error sending direct message:", error);
		}
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
			// If Firebase is available, use it
			if (firebaseAvailable) {
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
			} else {
				// Use direct connection
				this.useDirectConnection = true;
				this.log("Using direct connection (Firebase not available)");

				// Announce our presence
				this.sendDirectMessage({
					type: "deviceConnected",
					sessionId: this.sessionId,
					deviceId: this.deviceId,
					deviceType: this.deviceType,
					timestamp: Date.now(),
				});
			}

			this.isInitialized = true;
			this.connectionStatus = "connecting";

			// Emit connection status change
			this.emit(EVENT_TYPES.CONNECTION_STATUS_CHANGED, {
				status: this.connectionStatus,
				sessionId: this.sessionId,
				deviceType: this.deviceType,
				deviceId: this.deviceId,
			});

			// Set up a ping interval to keep the connection alive
			this.pingInterval = setInterval(() => {
				if (this.isInitialized) {
					if (this.useDirectConnection) {
						this.sendDirectMessage({
							type: "ping",
							sessionId: this.sessionId,
							deviceId: this.deviceId,
							deviceType: this.deviceType,
							timestamp: Date.now(),
						});
					} else if (firebaseAvailable) {
						// Update last seen timestamp
						const deviceRef = ref(
							database,
							`sessions/${this.sessionId}/devices/${this.deviceId}`
						);
						update(deviceRef, {
							lastSeen: Date.now(),
						}).catch((error) => {
							console.error("Error updating last seen timestamp:", error);
						});
					}
				}
			}, 30000); // Every 30 seconds

			this.log("Connection service initialized successfully");
			return true;
		} catch (error) {
			console.error("Error initializing connection service:", error);

			// Fall back to direct connection if Firebase fails
			if (!this.useDirectConnection) {
				this.useDirectConnection = true;
				this.log("Falling back to direct connection");

				// Announce our presence
				this.sendDirectMessage({
					type: "deviceConnected",
					sessionId: this.sessionId,
					deviceId: this.deviceId,
					deviceType: this.deviceType,
					timestamp: Date.now(),
				});

				this.isInitialized = true;
				this.connectionStatus = "connecting";

				// Emit connection status change
				this.emit(EVENT_TYPES.CONNECTION_STATUS_CHANGED, {
					status: this.connectionStatus,
					sessionId: this.sessionId,
					deviceType: this.deviceType,
					deviceId: this.deviceId,
				});

				return true;
			}

			return false;
		}
	}

	setupConnectionListeners() {
		if (!firebaseAvailable) return;

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
		if (!firebaseAvailable) return false;

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

			// Fall back to direct connection
			this.useDirectConnection = true;
			this.log("Falling back to direct connection due to registration error");

			// Announce our presence
			this.sendDirectMessage({
				type: "deviceConnected",
				sessionId: this.sessionId,
				deviceId: this.deviceId,
				deviceType: this.deviceType,
				timestamp: Date.now(),
			});

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

		const heartRateData = {
			heartRate: data.heartRate,
			timestamp: data.timestamp || Date.now(),
			rawData: data.rawData,
			deviceId: this.deviceId,
			sessionId: this.sessionId,
			type: "heartRateData",
		};

		try {
			// If using direct connection, send via postMessage
			if (this.useDirectConnection) {
				this.sendDirectMessage(heartRateData);
				this.log("Heart rate data sent via direct connection:", heartRateData);
				return true;
			}

			// Otherwise, send via Firebase
			if (firebaseAvailable) {
				// Send heart rate data to Firebase
				const heartRateRef = ref(
					database,
					`sessions/${this.sessionId}/heartRateData`
				);
				await set(heartRateRef, heartRateData);

				this.log("Heart rate data sent via Firebase:", heartRateData);
				return true;
			}

			return false;
		} catch (error) {
			console.error("Error sending heart rate data:", error);

			// Fall back to direct connection
			if (!this.useDirectConnection) {
				this.useDirectConnection = true;
				this.log("Falling back to direct connection for heart rate data");
				this.sendDirectMessage(heartRateData);
				return true;
			}

			return false;
		}
	}

	async sendMessage(message) {
		if (!this.isInitialized) {
			console.error("Connection service not initialized");
			return false;
		}

		const messageData = {
			text: message,
			fromDeviceId: this.deviceId,
			fromDeviceType: this.deviceType,
			timestamp: Date.now(),
			// If we have a paired device, target the message to that device
			targetDeviceId: this.pairedDeviceId || null,
			sessionId: this.sessionId,
			type: "message",
		};

		try {
			// If using direct connection, send via postMessage
			if (this.useDirectConnection) {
				this.sendDirectMessage(messageData);
				this.log("Message sent via direct connection:", messageData);
				return true;
			}

			// Otherwise, send via Firebase
			if (firebaseAvailable) {
				// Generate a unique message ID
				const messageId = `${Date.now()}-${Math.random()
					.toString(36)
					.substring(2, 9)}`;

				// Send message to Firebase
				const messageRef = ref(
					database,
					`sessions/${this.sessionId}/messages/${messageId}`
				);
				await set(messageRef, messageData);

				this.log("Message sent via Firebase:", messageData);
				return true;
			}

			return false;
		} catch (error) {
			console.error("Error sending message:", error);

			// Fall back to direct connection
			if (!this.useDirectConnection) {
				this.useDirectConnection = true;
				this.log("Falling back to direct connection for messages");
				this.sendDirectMessage(messageData);
				return true;
			}

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
			// Clear ping interval
			if (this.pingInterval) {
				clearInterval(this.pingInterval);
				this.pingInterval = null;
			}

			// If using direct connection, send disconnect message
			if (this.useDirectConnection) {
				this.sendDirectMessage({
					type: "deviceDisconnected",
					sessionId: this.sessionId,
					deviceId: this.deviceId,
					deviceType: this.deviceType,
					timestamp: Date.now(),
				});
			}

			// If using Firebase, update device status
			if (firebaseAvailable && this.sessionId && this.deviceId) {
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

	// Add a new method to send camera frame data
	async sendCameraFrame(imageData) {
		if (!this.isInitialized) {
			console.error("Connection service not initialized");
			return false;
		}

		if (this.deviceType !== "mobile") {
			console.error("Only mobile devices can send camera frames");
			return false;
		}

		try {
			// If using direct connection, send via postMessage
			if (this.useDirectConnection) {
				this.sendDirectMessage({
					type: "cameraFrame",
					sessionId: this.sessionId,
					deviceId: this.deviceId,
					imageData: imageData,
					timestamp: Date.now(),
				});
				return true;
			}

			// Otherwise, send via Firebase
			if (firebaseAvailable) {
				// Send camera frame data to Firebase
				const frameRef = ref(
					database,
					`sessions/${this.sessionId}/cameraFrame`
				);
				await set(frameRef, {
					imageData: imageData,
					timestamp: Date.now(),
					deviceId: this.deviceId,
				});

				return true;
			}

			return false;
		} catch (error) {
			console.error("Error sending camera frame:", error);
			return false;
		}
	}

	// Add a method to get the database instance
	getDatabase() {
		if (firebaseAvailable) {
			return database;
		}
		return null;
	}
}

// Create a singleton instance
const connectionService = new ConnectionService();

export default connectionService;
