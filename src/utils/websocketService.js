/**
 * WebSocket Service for CardboardHRV
 *
 * This service provides a client-side implementation of WebSocket functionality
 * to enable communication between the main application and mobile devices.
 *
 * In a production environment, this would be replaced with a proper server-side
 * WebSocket implementation.
 */

class WebSocketService {
	constructor() {
		this.connections = new Map();
		this.sessionMap = new Map();
		this.eventListeners = new Map();
		this.isInitialized = false;
	}

	/**
	 * Initialize the WebSocket service
	 */
	initialize() {
		if (this.isInitialized) return;

		// Set up custom event listeners for WebSocket simulation
		window.addEventListener(
			"cardboardhrv-ws-connect",
			this.handleConnect.bind(this)
		);
		window.addEventListener(
			"cardboardhrv-ws-message",
			this.handleMessage.bind(this)
		);
		window.addEventListener(
			"cardboardhrv-ws-close",
			this.handleClose.bind(this)
		);

		// Create a mock WebSocket endpoint
		this.mockWebSocketEndpoint();

		this.isInitialized = true;
		console.log("WebSocket service initialized");
	}

	/**
	 * Create a mock WebSocket endpoint that can be connected to
	 */
	mockWebSocketEndpoint() {
		// Override the WebSocket constructor to intercept connections to our endpoint
		const originalWebSocket = window.WebSocket;
		const self = this;

		window.WebSocket = function (url, protocols) {
			// Check if this is a connection to our mock endpoint
			if (url.includes("/ws")) {
				console.log("Intercepting WebSocket connection to:", url);

				// Create a mock WebSocket object
				const mockWs = {
					url,
					readyState: WebSocket.CONNECTING,
					send: function (data) {
						// Dispatch a custom event to simulate sending a message
						window.dispatchEvent(
							new CustomEvent("cardboardhrv-ws-message", {
								detail: {
									clientId: this._clientId,
									message: data,
								},
							})
						);
					},
					close: function () {
						this.readyState = WebSocket.CLOSED;
						if (this.onclose) {
							this.onclose({ code: 1000, reason: "Normal closure" });
						}

						// Dispatch a custom event to simulate closing the connection
						window.dispatchEvent(
							new CustomEvent("cardboardhrv-ws-close", {
								detail: { clientId: this._clientId },
							})
						);
					},
				};

				// Generate a client ID
				const clientId =
					"client-" +
					Date.now() +
					"-" +
					Math.random().toString(36).substr(2, 9);
				mockWs._clientId = clientId;

				// Store the connection
				self.connections.set(clientId, mockWs);

				// Simulate connection establishment
				setTimeout(() => {
					mockWs.readyState = WebSocket.OPEN;
					if (mockWs.onopen) {
						mockWs.onopen({});
					}

					// Dispatch a custom event to notify the server of the connection
					window.dispatchEvent(
						new CustomEvent("cardboardhrv-ws-connect", {
							detail: {
								clientId,
								callback: (client) => {
									// Store the server-side client reference
									mockWs._serverClient = client;
								},
							},
						})
					);
				}, 100);

				return mockWs;
			}

			// If not our endpoint, use the original WebSocket
			return new originalWebSocket(url, protocols);
		};

		// Copy static properties and methods
		for (const prop in originalWebSocket) {
			window.WebSocket[prop] = originalWebSocket[prop];
		}
	}

	/**
	 * Handle a new WebSocket connection
	 * @param {CustomEvent} event - The connection event
	 */
	handleConnect(event) {
		const { clientId, callback } = event.detail;

		// Create a client object
		const client = {
			id: clientId,
			sessionId: null,
			send: (message) => {
				const connection = this.connections.get(clientId);
				if (connection && connection.onmessage) {
					connection.onmessage({ data: message });
				}
			},
			close: () => {
				const connection = this.connections.get(clientId);
				if (connection) {
					if (connection.onclose) {
						connection.onclose({
							code: 1000,
							reason: "Server closed connection",
						});
					}
					this.connections.delete(clientId);
				}
			},
		};

		// Call the callback with the client object
		if (callback) {
			callback(client);
		}

		// Emit a connection event
		this.emit("connection", client);
	}

	/**
	 * Handle a WebSocket message
	 * @param {CustomEvent} event - The message event
	 */
	handleMessage(event) {
		const { clientId, message } = event.detail;

		// Find the client
		const connection = this.connections.get(clientId);
		if (!connection || !connection._serverClient) return;

		// Parse the message
		try {
			const data = JSON.parse(message);

			// If this is an initialization message with a session ID
			if (data.type === "init" && data.sessionId) {
				connection._serverClient.sessionId = data.sessionId;
				this.sessionMap.set(data.sessionId, connection._serverClient);

				// Emit a session event
				this.emit("session", {
					sessionId: data.sessionId,
					client: connection._serverClient,
				});
			}

			// Call the onMessage handler
			if (connection._serverClient.onMessage) {
				connection._serverClient.onMessage(message);
			}

			// Emit a message event
			this.emit("message", {
				client: connection._serverClient,
				data,
			});
		} catch (error) {
			console.error("Error parsing WebSocket message:", error);
		}
	}

	/**
	 * Handle a WebSocket connection close
	 * @param {CustomEvent} event - The close event
	 */
	handleClose(event) {
		const { clientId } = event.detail;

		// Find the client
		const connection = this.connections.get(clientId);
		if (!connection || !connection._serverClient) return;

		// Remove the session mapping if it exists
		if (connection._serverClient.sessionId) {
			this.sessionMap.delete(connection._serverClient.sessionId);
		}

		// Call the onClose handler
		if (connection._serverClient.onClose) {
			connection._serverClient.onClose();
		}

		// Remove the connection
		this.connections.delete(clientId);

		// Emit a close event
		this.emit("close", {
			clientId,
			client: connection._serverClient,
		});
	}

	/**
	 * Send a message to a client by session ID
	 * @param {string} sessionId - The session ID
	 * @param {object} data - The data to send
	 */
	sendToSession(sessionId, data) {
		const client = this.sessionMap.get(sessionId);
		if (client) {
			client.send(JSON.stringify(data));
			return true;
		}
		return false;
	}

	/**
	 * Register an event listener
	 * @param {string} event - The event name
	 * @param {function} callback - The callback function
	 */
	on(event, callback) {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, []);
		}
		this.eventListeners.get(event).push(callback);
	}

	/**
	 * Remove an event listener
	 * @param {string} event - The event name
	 * @param {function} callback - The callback function
	 */
	off(event, callback) {
		if (!this.eventListeners.has(event)) return;

		const listeners = this.eventListeners.get(event);
		const index = listeners.indexOf(callback);

		if (index !== -1) {
			listeners.splice(index, 1);
		}
	}

	/**
	 * Emit an event
	 * @param {string} event - The event name
	 * @param {*} data - The event data
	 */
	emit(event, data) {
		if (!this.eventListeners.has(event)) return;

		for (const callback of this.eventListeners.get(event)) {
			callback(data);
		}
	}

	/**
	 * Close all connections
	 */
	closeAll() {
		for (const connection of this.connections.values()) {
			if (connection.close) {
				connection.close();
			}
		}

		this.connections.clear();
		this.sessionMap.clear();
	}

	/**
	 * Clean up the service
	 */
	cleanup() {
		this.closeAll();

		window.removeEventListener("cardboardhrv-ws-connect", this.handleConnect);
		window.removeEventListener("cardboardhrv-ws-message", this.handleMessage);
		window.removeEventListener("cardboardhrv-ws-close", this.handleClose);

		this.isInitialized = false;
	}
}

// Create a singleton instance
const websocketService = new WebSocketService();

export default websocketService;
