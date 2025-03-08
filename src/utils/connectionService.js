/**
 * Connection Service
 *
 * This service uses Firebase Realtime Database for reliable cross-device communication.
 * It provides a simple API for connecting devices and sharing data between them.
 */

// Firebase configuration
const firebaseConfig = {
	apiKey: "AIzaSyDQzFOQoDgYMXnrLd8nOkD5-N-_X4-cdSw",
	authDomain: "cardboardhrv.firebaseapp.com",
	databaseURL: "https://cardboardhrv-default-rtdb.firebaseio.com",
	projectId: "cardboardhrv",
	storageBucket: "cardboardhrv.appspot.com",
	messagingSenderId: "1082669024548",
	appId: "1:1082669024548:web:3a5e9d8e9f9f9f9f9f9f9f",
};

class ConnectionService {
	constructor() {
		this.firebase = null;
		this.database = null;
		this.sessionRef = null;
		this.sessionId = null;
		this.isInitialized = false;
		this.eventListeners = {};
		this.deviceType = null; // 'mobile' or 'desktop'
		this.connectionStatus = "disconnected";
	}

	/**
	 * Initialize the connection service
	 * @param {string} sessionId - The session ID to use for the connection
	 * @param {string} deviceType - The type of device ('mobile' or 'desktop')
	 * @returns {Promise<boolean>} - Whether initialization was successful
	 */
	async initialize(sessionId, deviceType) {
		if (this.isInitialized) {
			console.log("Connection service already initialized");
			return true;
		}

		try {
			// Import Firebase dynamically
			const firebaseApp = await import(
				"https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js"
			);
			const firebaseDatabase = await import(
				"https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js"
			);

			// Initialize Firebase
			this.firebase = firebaseApp;
			const app = firebaseApp.initializeApp(firebaseConfig);
			this.database = firebaseDatabase.getDatabase(app);

			this.sessionId = sessionId;
			this.deviceType = deviceType;

			// Set up session reference
			this.sessionRef = firebaseDatabase.ref(
				this.database,
				`sessions/${sessionId}`
			);

			// Set up connection status listener
			this.setupConnectionListeners(firebaseDatabase);

			this.isInitialized = true;
			console.log(
				`Connection service initialized for session ${sessionId} as ${deviceType}`
			);

			// Register this device
			await this.registerDevice();

			return true;
		} catch (error) {
			console.error("Failed to initialize connection service:", error);

			// Fallback to localStorage for same-device testing
			this.setupLocalStorageFallback();

			return false;
		}
	}

	/**
	 * Set up a fallback using localStorage for same-device testing
	 */
	setupLocalStorageFallback() {
		console.log("Setting up localStorage fallback for connection service");

		// Set up interval to check localStorage
		setInterval(() => {
			try {
				const data = localStorage.getItem(`cardboardhrv-${this.sessionId}`);
				if (data) {
					const parsedData = JSON.parse(data);
					this.handleDataUpdate(parsedData);
				}
			} catch (error) {
				console.error("Error checking localStorage:", error);
			}
		}, 1000);
	}

	/**
	 * Set up connection status listeners
	 * @param {object} firebaseDatabase - The Firebase database module
	 */
	setupConnectionListeners(firebaseDatabase) {
		// Listen for connection status changes
		const connectedRef = firebaseDatabase.ref(this.database, ".info/connected");
		firebaseDatabase.onValue(connectedRef, (snap) => {
			if (snap.val() === true) {
				console.log("Connected to Firebase");

				// When we disconnect, remove this device
				firebaseDatabase
					.onDisconnect(
						firebaseDatabase.ref(
							this.database,
							`sessions/${this.sessionId}/devices/${this.deviceType}`
						)
					)
					.remove();

				// Update connection status
				this.connectionStatus = "connected";
				this.emit("connectionStatusChanged", { status: "connected" });
			} else {
				console.log("Disconnected from Firebase");
				this.connectionStatus = "disconnected";
				this.emit("connectionStatusChanged", { status: "disconnected" });
			}
		});

		// Listen for data changes
		firebaseDatabase.onValue(this.sessionRef, (snapshot) => {
			const data = snapshot.val();
			if (data) {
				this.handleDataUpdate(data);
			}
		});
	}

	/**
	 * Handle data updates from Firebase
	 * @param {object} data - The updated data
	 */
	handleDataUpdate(data) {
		// Check if both devices are connected
		const isMobileConnected = data.devices && data.devices.mobile;
		const isDesktopConnected = data.devices && data.devices.desktop;

		if (isMobileConnected && isDesktopConnected) {
			this.connectionStatus = "paired";
			this.emit("devicesPaired", {
				mobile: data.devices.mobile,
				desktop: data.devices.desktop,
			});
		} else if (this.connectionStatus === "paired") {
			this.connectionStatus = "connected";
			this.emit("deviceDisconnected", {
				isMobileConnected,
				isDesktopConnected,
			});
		}

		// Handle heart rate data
		if (data.heartRateData) {
			this.emit("heartRateData", data.heartRateData);
		}

		// Handle messages
		if (data.messages) {
			const messages = Object.values(data.messages);
			const latestMessage = messages[messages.length - 1];
			if (
				latestMessage &&
				latestMessage.timestamp > (this.lastMessageTimestamp || 0)
			) {
				this.lastMessageTimestamp = latestMessage.timestamp;
				this.emit("message", latestMessage);
			}
		}
	}

	/**
	 * Register this device with the session
	 */
	async registerDevice() {
		if (!this.isInitialized) return false;

		try {
			const deviceData = {
				type: this.deviceType,
				userAgent: navigator.userAgent,
				timestamp: Date.now(),
			};

			if (this.firebase) {
				// Use Firebase
				const firebaseDatabase = await import(
					"https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js"
				);
				firebaseDatabase.set(
					firebaseDatabase.ref(
						this.database,
						`sessions/${this.sessionId}/devices/${this.deviceType}`
					),
					deviceData
				);
			} else {
				// Use localStorage fallback
				const sessionData = JSON.parse(
					localStorage.getItem(`cardboardhrv-${this.sessionId}`) || "{}"
				);
				if (!sessionData.devices) sessionData.devices = {};
				sessionData.devices[this.deviceType] = deviceData;
				localStorage.setItem(
					`cardboardhrv-${this.sessionId}`,
					JSON.stringify(sessionData)
				);
			}

			console.log(
				`Registered ${this.deviceType} device for session ${this.sessionId}`
			);
			return true;
		} catch (error) {
			console.error("Failed to register device:", error);
			return false;
		}
	}

	/**
	 * Send heart rate data
	 * @param {object} data - The heart rate data to send
	 */
	async sendHeartRateData(data) {
		if (!this.isInitialized) return false;

		try {
			const heartRateData = {
				...data,
				timestamp: Date.now(),
				deviceType: this.deviceType,
			};

			if (this.firebase) {
				// Use Firebase
				const firebaseDatabase = await import(
					"https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js"
				);
				firebaseDatabase.set(
					firebaseDatabase.ref(
						this.database,
						`sessions/${this.sessionId}/heartRateData`
					),
					heartRateData
				);
			} else {
				// Use localStorage fallback
				const sessionData = JSON.parse(
					localStorage.getItem(`cardboardhrv-${this.sessionId}`) || "{}"
				);
				sessionData.heartRateData = heartRateData;
				localStorage.setItem(
					`cardboardhrv-${this.sessionId}`,
					JSON.stringify(sessionData)
				);
			}

			return true;
		} catch (error) {
			console.error("Failed to send heart rate data:", error);
			return false;
		}
	}

	/**
	 * Send a message to the other device
	 * @param {string} message - The message to send
	 */
	async sendMessage(message) {
		if (!this.isInitialized) return false;

		try {
			const messageData = {
				text: message,
				timestamp: Date.now(),
				deviceType: this.deviceType,
			};

			if (this.firebase) {
				// Use Firebase
				const firebaseDatabase = await import(
					"https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js"
				);
				const newMessageRef = firebaseDatabase.push(
					firebaseDatabase.ref(
						this.database,
						`sessions/${this.sessionId}/messages`
					)
				);
				firebaseDatabase.set(newMessageRef, messageData);
			} else {
				// Use localStorage fallback
				const sessionData = JSON.parse(
					localStorage.getItem(`cardboardhrv-${this.sessionId}`) || "{}"
				);
				if (!sessionData.messages) sessionData.messages = [];
				sessionData.messages.push(messageData);
				localStorage.setItem(
					`cardboardhrv-${this.sessionId}`,
					JSON.stringify(sessionData)
				);
			}

			return true;
		} catch (error) {
			console.error("Failed to send message:", error);
			return false;
		}
	}

	/**
	 * Check if both devices are connected
	 * @returns {boolean} - Whether both devices are connected
	 */
	areBothDevicesConnected() {
		return this.connectionStatus === "paired";
	}

	/**
	 * Register an event listener
	 * @param {string} event - The event to listen for
	 * @param {function} callback - The callback function
	 */
	on(event, callback) {
		if (!this.eventListeners[event]) {
			this.eventListeners[event] = [];
		}
		this.eventListeners[event].push(callback);
	}

	/**
	 * Remove an event listener
	 * @param {string} event - The event to remove the listener from
	 * @param {function} callback - The callback function to remove
	 */
	off(event, callback) {
		if (!this.eventListeners[event]) return;

		const index = this.eventListeners[event].indexOf(callback);
		if (index !== -1) {
			this.eventListeners[event].splice(index, 1);
		}
	}

	/**
	 * Emit an event
	 * @param {string} event - The event to emit
	 * @param {object} data - The data to emit with the event
	 */
	emit(event, data) {
		if (!this.eventListeners[event]) return;

		for (const callback of this.eventListeners[event]) {
			callback(data);
		}
	}

	/**
	 * Disconnect from the session
	 */
	async disconnect() {
		if (!this.isInitialized) return;

		try {
			if (this.firebase) {
				// Use Firebase
				const firebaseDatabase = await import(
					"https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js"
				);
				firebaseDatabase.remove(
					firebaseDatabase.ref(
						this.database,
						`sessions/${this.sessionId}/devices/${this.deviceType}`
					)
				);
			} else {
				// Use localStorage fallback
				const sessionData = JSON.parse(
					localStorage.getItem(`cardboardhrv-${this.sessionId}`) || "{}"
				);
				if (sessionData.devices) {
					delete sessionData.devices[this.deviceType];
					localStorage.setItem(
						`cardboardhrv-${this.sessionId}`,
						JSON.stringify(sessionData)
					);
				}
			}

			this.isInitialized = false;
			this.connectionStatus = "disconnected";
			this.emit("connectionStatusChanged", { status: "disconnected" });

			console.log(
				`Disconnected ${this.deviceType} device from session ${this.sessionId}`
			);
		} catch (error) {
			console.error("Failed to disconnect:", error);
		}
	}
}

// Create a singleton instance
const connectionService = new ConnectionService();

export default connectionService;
