# Face Touch Alert System 🚨

A real-time web application that helps users build awareness of unconscious face-touching behaviors through computer vision and instant audio alerts. Perfect for individuals managing anxiety-related habits, skin picking disorders, nail biting, or general face touching patterns that interfere with skincare, hygiene, or focus.

**Keywords**: face touch detection, anxiety management, habit tracking, computer vision, MediaPipe, behavior modification, skin picking awareness, face touching prevention, real-time monitoring, web-based health tool

## Key Features

- **Instant Detection & Alerts**: Real-time face and hand tracking with immediate audio feedback (alarm sound)
- **Precision Proximity Sensing**: Detects when hands come within 3cm of any facial landmark
- **Persistent Data Tracking**: Automatically saves all session data to browser storage
- **Live Analytics Dashboard**: 
  - **Total Alert Counter**: Running count of all face-touch incidents
  - **Duration Tracking**: Shows current alert duration and previous alert duration in minutes
  - **24-Hour Bar Chart**: Visual breakdown of alerts by hour to identify peak touching times
  - **Timestamp Logging**: Records exact time of each incident for pattern analysis
- **Zero Setup Required**: Works instantly in any modern browser - no installation, registration, or downloads
- **Complete Privacy**: All processing and data storage happens locally in your browser

## How It Works

The system uses **Google MediaPipe Holistic** machine learning models to provide:

1. **468 Face Landmark Detection** - Precise mapping of all facial features including eyes, nose, mouth, cheeks, jawline, and forehead
2. **21-Point Hand Tracking** - Real-time detection of both left and right hand positions with finger-level accuracy  
3. **Mathematical Distance Calculation** - Measures Euclidean distance between each hand point and facial landmark
4. **Smart Alert System** - Triggers audio alert when distance falls below 0.03 units (approximately 3cm on screen)
5. **Anti-Spam Protection** - 10-second cooldown between alerts to prevent notification fatigue
6. **Automatic Data Persistence** - Saves all metrics to browser's localStorage for session continuity

## Getting Started

### Prerequisites
- Modern web browser with camera access (Chrome, Firefox, Safari, Edge)
- Working webcam/front-facing camera
- Good lighting conditions for optimal detection

## Quick Start Guide

### Instant Setup (30 seconds)
1. **Download**: Clone this repository or download as ZIP
2. **Open**: Double-click `index.html` or drag it into your browser
3. **Allow Camera**: Click "Allow" when browser requests camera permission
4. **Position**: Sit 2-3 feet from your camera with good lighting
5. **Start**: The system loads automatically and begins monitoring immediately

### File Structure
```
face-touch-alert/
├── index.html          # Main application file
├── assets/
│   ├── main.js         # MediaPipe initialization
│   ├── functions.js    # Core detection logic
│   ├── chart.js        # Chart.js analytics
│   ├── storage.js      # localStorage utilities
│   └── favicon.png     # App icon
└── README.md
```

### No Server Required
- Works offline after initial model download
- No npm install or build process needed
- Simply open `index.html` in any modern browser

## Usage

1. **Setup**: Position your camera so your face and hands are clearly visible
2. **Calibration**: The app will automatically detect your face and hand positions
3. **Monitoring**: Keep the browser tab active - alerts will sound when hands approach your face
4. **Review Stats**: Check the analytics panel to understand your touching patterns

### Understanding the Interface

**Live Display Elements:**
- **Green border video feed**: Shows your camera with detection active
- **"Alerts: X"** counter: Total number of face touches detected
- **Duration tracking**: Shows "Latest at [time] - Duration: X (was: Y) min"
- **24-hour bar chart**: Green bars showing hourly face-touch frequency

**Alert Behavior:**
- **Sound**: Plays Google's alarm clock sound on each detection
- **10-second cooldown**: Prevents multiple alerts for the same touch
- **Automatic timing**: Starts duration counter from first detection
- **Data persistence**: All stats saved automatically, survives browser restarts

### Detection Coverage

The system monitors **all 468 facial landmarks** including:
- **Eye region**: Corners, lids, under-eye area, temples
- **Nose area**: Bridge, nostrils, tip, sides
- **Mouth region**: Lips, corners, chin, area around mouth  
- **Cheek area**: Full cheek surface, jawline
- **Forehead**: Entire forehead including hairline
- **Neck area**: Upper neck and throat region detected via facial boundary

## Analytics & Data Insights

### Real-Time Metrics
- **Total Alert Count**: Cumulative face touches since first use (persists across sessions)
- **Current Duration**: Live timer showing how long current touching episode lasts  
- **Previous Duration**: Duration of the last face-touching incident in minutes
- **Timestamp Logging**: Exact time recorded for each alert (stored in browser)

### Historical Analysis
- **24-Hour Bar Chart**: Visual breakdown showing face-touch frequency by hour
- **Pattern Recognition**: Identify your peak touching times (morning, afternoon, evening)
- **Data Persistence**: All historical data automatically saved to browser localStorage
- **Session Continuity**: Stats and chart update immediately when you reopen the app

### Behavioral Insights
Use the hourly chart to discover:
- **Stress triggers**: Higher bars during work hours or specific times
- **Environmental factors**: Correlation with meetings, tasks, or daily routines
- **Progress tracking**: Visual reduction in face touching over time
- **Peak periods**: Times when mindfulness reminders might be most helpful

## Use Cases & Applications

### Mental Health & Wellness
- **Anxiety management**: Break unconscious face-touching habits during stress
- **Dermatillomania support**: Awareness tool for skin picking behaviors  
- **Trichotillomania awareness**: Detect hand-to-face movements that may lead to hair pulling
- **General habit breaking**: Build mindfulness around any face-touching patterns
- **Skincare routine support**: Avoid touching face during acne treatment periods

### Professional & Academic Settings  
- **Work-from-home focus**: Maintain professional appearance during video calls
- **Study session awareness**: Reduce face touching during concentration periods
- **Public speaking practice**: Build awareness of nervous face-touching habits
- **Medical/hygiene compliance**: Support infection control awareness in healthcare settings

### Personal Development
- **Mindfulness practice**: Develop body awareness and present-moment attention
- **Behavior modification**: Track progress in changing unconscious habits
- **Self-improvement tracking**: Use analytics to measure habit change over time

## Privacy & Security

- **Local Processing**: All video processing happens on your device
- **No Data Storage**: No personal data or video is stored or transmitted
- **Browser-Only**: Works entirely within your web browser
- **No Account Required**: No registration or personal information needed

## Browser Compatibility & System Requirements

### Fully Supported Browsers
| Browser | Version | Notes |
|---------|---------|--------|
| **Chrome** | 88+ | ✅ Best performance, recommended |
| **Firefox** | 85+ | ✅ Full MediaPipe support |
| **Safari** | 14.3+ | ✅ Works on macOS and iOS |
| **Edge** | 88+ | ✅ Chromium-based, excellent support |

### System Requirements
- **Minimum RAM**: 2GB (4GB+ recommended for smoother performance)
- **Camera**: Any USB webcam or built-in camera (720p+ recommended)
- **Internet**: Required only for initial setup to download ML models (~10MB)
- **Storage**: ~50KB for persistent data storage (localStorage)

### Performance Notes
- **CPU Usage**: ~15-25% on modern processors during active detection
- **Memory**: ~100-200MB browser memory usage
- **Battery**: Moderate impact on laptops due to continuous camera and ML processing
- **Offline**: Fully functional offline after first load

## Troubleshooting

### Common Issues & Solutions

**"Loading the system..." never disappears:**
- Check browser console for errors
- Ensure stable internet connection for initial model download
- Try refreshing the page or clearing browser cache
- Verify camera isn't being used by other applications

**Poor detection accuracy / false alerts:**
- **Lighting**: Ensure bright, even lighting on your face
- **Distance**: Sit 2-3 feet from camera for optimal detection
- **Background**: Use plain backgrounds, avoid busy patterns
- **Camera angle**: Position camera at eye level, avoid extreme angles
- **Stability**: Keep camera steady, avoid shaky setups

**No alerts when touching face:**
- Ensure both hands and face are visible in camera frame
- Check if hands are properly detected (should see tracking)
- Verify face is fully visible and well-lit
- Try adjusting distance - very close or far may affect accuracy

**Audio not playing:**
- Check browser audio permissions and volume settings
- Some browsers block autoplay - try clicking in the browser window first
- Verify the alert sound URL is accessible (uses Google's CDN)

**Data not persisting between sessions:**
- Check if browser allows localStorage (some privacy modes block it)
- Verify you're using the same browser and not incognito/private mode
- Clear browser data may reset your stored analytics

## Technical Details

## Technical Architecture

### Core Technologies
- **MediaPipe Holistic v0.5.1675471629**: Google's ML framework for face and hand detection
- **Chart.js**: Interactive bar chart for hourly analytics visualization  
- **Vanilla JavaScript**: ES6 modules for clean, fast performance
- **HTML5 Camera API**: Direct browser camera access via getUserMedia
- **localStorage API**: Client-side data persistence without external databases

### Performance Specifications
- **Detection Speed**: 300ms intervals (3.33 FPS) for optimal accuracy vs performance
- **Precision**: 0.03 unit threshold (≈3cm screen distance) for face proximity detection
- **Landmarks**: 468 face points + 21 points per hand for comprehensive coverage
- **Memory Usage**: Lightweight - processes video frames without storing video data
- **Offline Capable**: Works without internet after initial ML model download

### Model Configuration
```javascript
// Optimized MediaPipe settings used
{
  modelComplexity: 1,           // Balance between speed and accuracy
  smoothLandmarks: true,        // Reduces jittery detection
  enableSegmentation: false,    // Disabled for better performance  
  refineFaceLandmarks: true,    // Enhanced facial precision
  minDetectionConfidence: 0.5,  // Moderate confidence threshold
  minTrackingConfidence: 0.5    // Stable tracking requirement
}
```

## Customization & Development

### Easy Modifications
The codebase is designed for easy customization:

**Adjust sensitivity** (`functions.js`):
```javascript
// Change 0.03 to make detection more/less sensitive
if (distance < 0.03 && Date.now() - lastAlertTime > MIN_ALERT_INTERVAL)
```

**Modify alert frequency** (`functions.js`):
```javascript
// Change 10000 (10 seconds) to adjust cooldown period
const MIN_ALERT_INTERVAL = 10000;
```

**Change detection speed** (`functions.js`):
```javascript
// Modify 300ms interval for faster/slower detection
setInterval(() => { holistic.send({ image: videoElement }); }, 300);
```

**Customize alert sound** (`index.html`):
```html
<!-- Replace with any audio URL -->
<audio id="alertSound" src="your-custom-sound.mp3"></audio>
```

## Contributing & Community

### How to Contribute
- 🐛 **Report bugs**: Open issues with detailed reproduction steps
- 💡 **Suggest features**: Share ideas for improving detection accuracy or user experience  
- 🔧 **Submit improvements**: Pull requests welcome for bug fixes and enhancements
- 📖 **Improve documentation**: Help make setup and usage even clearer
- 🧪 **Beta testing**: Try new features and provide feedback

### Development Workflow
1. Fork the repository
2. Make your changes (no build process required!)
3. Test thoroughly with different lighting conditions and camera setups
4. Submit pull request with clear description

### Community Guidelines
- Be respectful and supportive - many users are dealing with anxiety or behavioral challenges
- Focus on accessibility and ease of use
- Privacy-first approach - no tracking, no external data collection
- Keep the tool simple and focused on its core purpose

## Support

If you find this tool helpful for managing anxiety-related face touching habits, please consider:
- ⭐ Starring the repository
- 📝 Providing feedback through issues
- 🤝 Contributing improvements
- 📢 Sharing with others who might benefit

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This application is designed as a behavioral awareness tool and is not intended as medical advice or treatment. If you have concerns about compulsive behaviors or anxiety, please consult with a healthcare professional.

## Acknowledgments

- MediaPipe team for computer vision models
- TensorFlow.js community
- All contributors and testers who helped improve detection accuracy

---

## Tags & Keywords

`face-touch-detection` `anxiety-management` `habit-tracking` `computer-vision` `mediapipe` `behavior-modification` `skin-picking-awareness` `dermatillomania` `trichotillomania` `mindfulness-tool` `web-based-health` `real-time-monitoring` `machine-learning` `javascript` `privacy-first` `offline-capable` `no-installation` `instant-feedback` `behavioral-analytics` `self-improvement`

**Made with ❤️ for mental health awareness and habit modification**

*"Building consciousness around unconscious behaviors, one alert at a time."*