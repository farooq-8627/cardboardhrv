# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript and enable type-aware lint rules. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# CardboardHRV

CardboardHRV is a web-based application that transforms your smartphone into a heart rate monitor using just your phone's camera. This project demonstrates how to use photoplethysmography (PPG) techniques to detect heart rate and calculate heart rate variability (HRV) metrics in real-time.

![CardboardHRV](https://via.placeholder.com/800x400?text=CardboardHRV+Screenshot)

## Features

- **Camera-Based Heart Rate Detection**: Uses your smartphone's camera to detect subtle color changes in your skin that indicate your heartbeat
- **Real-Time HRV Metrics**: Calculates and displays key HRV metrics including SDNN, RMSSD, LF, HF, and LF/HF ratio
- **Cross-Device Communication**: Connect your phone to your laptop/desktop for synchronized monitoring
- **Responsive Design**: Works on various screen sizes and devices
- **Data Export**: Export your heart rate data for further analysis
- **No App Installation Required**: Works entirely in the browser with no need to install a mobile app

## How It Works

CardboardHRV uses the following technologies and techniques:

1. **Photoplethysmography (PPG)**: The camera detects subtle color changes in your skin that correspond to your pulse
2. **WebRTC and Custom Events**: For communication between your phone and computer
3. **Canvas API**: For processing video frames and extracting heart rate data
4. **React**: For building a responsive and interactive user interface

## Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari) on both your computer and smartphone
- Smartphone with a camera
- Both devices connected to the same network (for local development)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/farooq-8627/cardboardhrv.git
   cd cardboardhrv
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev -- --host
   ```

4. Open the displayed URL on your computer
5. Navigate to the "Connect Phone" page
6. Scan the QR code with your smartphone or enter the session ID manually
7. Follow the on-screen instructions to grant camera access
8. Start monitoring your heart rate!

## Usage

### Connecting Your Phone

1. On your computer, go to the "Connect Phone" page
2. You'll see a QR code and a session ID
3. On your smartphone, scan the QR code or navigate to the URL and enter the session ID manually
4. Grant camera access when prompted
5. Your phone is now connected to the application

### Monitoring Heart Rate

1. After connecting your phone, go to the "Live Monitor" page on your computer
2. You'll see real-time heart rate data and HRV metrics
3. Use the "Start Session" button to begin recording data
4. Use the "Stop Session" button to end recording
5. Use the "Export Data" button to download your session data as a CSV file

## Development

### Project Structure

```
cardboardhrv/
├── public/             # Static assets
├── src/                # Source code
│   ├── components/     # React components
│   ├── utils/          # Utility functions
│   ├── App.css         # Main CSS file
│   ├── App.jsx         # Main application component
│   └── main.jsx        # Entry point
├── package.json        # Dependencies and scripts
└── README.md           # This file
```

### Key Components

- **App.jsx**: Main application component and routing
- **ConnectPhone.jsx**: Component for connecting your phone to the application
- **ConnectMobile.jsx**: Component that runs on your phone for camera access
- **LiveMonitor.jsx**: Component for displaying heart rate data and HRV metrics
- **websocketService.js**: Service for handling communication between devices

## Technical Challenges

The project addresses several technical challenges:

1. **Cross-Device Communication**: Using custom events to simulate WebSocket communication
2. **Camera Access in Mobile Browsers**: Handling various browser restrictions and permissions
3. **Real-Time Signal Processing**: Extracting heart rate data from video frames
4. **HRV Calculation**: Implementing algorithms to calculate heart rate variability metrics

## Future Improvements

- Implement more sophisticated PPG algorithms for better accuracy
- Add support for offline mode
- Improve heart rate detection in low-light conditions
- Add user accounts for saving and tracking data over time
- Implement real-time data visualization improvements

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by research on mobile PPG techniques
- Built with React and Vite
- Uses Chart.js for data visualization
- QR code generation with react-qr-code

---

Created by [Farooq](https://github.com/farooq-8627)
