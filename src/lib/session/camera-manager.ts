/**
 * Camera Manager
 * 
 * Handles camera permissions, streaming, and device management with graceful fallbacks.
 * Provides a clean API for camera operations with proper error handling.
 */

export interface CameraConstraints {
  video: {
    width?: { ideal: number; max?: number; min?: number };
    height?: { ideal: number; max?: number; min?: number };
    frameRate?: { ideal: number; max?: number; min?: number };
    facingMode?: 'user' | 'environment';
    deviceId?: string;
  };
  audio?: boolean;
}

export interface CameraDevice {
  deviceId: string;
  label: string;
  kind: 'videoinput' | 'audioinput' | 'audiooutput';
  groupId: string;
}

export interface CameraState {
  isAvailable: boolean;
  hasPermission: boolean;
  isStreaming: boolean;
  isRequesting: boolean;
  stream: MediaStream | null;
  error: string | null;
  devices: CameraDevice[];
  activeDeviceId: string | null;
}

export type CameraEventType = 'permission-change' | 'stream-change' | 'error' | 'devices-change';

export interface CameraEvent {
  type: CameraEventType;
  stream?: MediaStream;
  error?: Error;
  devices?: CameraDevice[];
}

/**
 * Default camera constraints optimized for breathing sessions
 */
const DEFAULT_CONSTRAINTS: CameraConstraints = {
  video: {
    width: { ideal: 640, max: 1280, min: 320 },
    height: { ideal: 480, max: 720, min: 240 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: 'user',
  },
  audio: false, // Audio not needed for breathing sessions
};

class CameraManager {
  private state: CameraState = {
    isAvailable: false,
    hasPermission: false,
    isStreaming: false,
    isRequesting: false,
    stream: null,
    error: null,
    devices: [],
    activeDeviceId: null,
  };

  private listeners: Set<(event: CameraEvent) => void> = new Set();
  private permissionWatcher: PermissionStatus | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize camera manager
   */
  private async initialize(): Promise<void> {
    try {
      // Check if getUserMedia is available
      this.state.isAvailable = !!(
        navigator.mediaDevices && 
        navigator.mediaDevices.getUserMedia
      );

      if (!this.state.isAvailable) {
        this.setState({ error: 'Camera not supported in this browser' });
        return;
      }

      // Check current permission state
      await this.checkPermission();

      // Watch for permission changes
      await this.setupPermissionWatcher();

      // Enumerate devices if we have permission
      if (this.state.hasPermission) {
        await this.updateDevices();
      }

    } catch (error) {
      this.setState({ 
        error: `Camera initialization failed: ${(error as Error).message}` 
      });
    }
  }

  /**
   * Check camera permission status
   */
  private async checkPermission(): Promise<void> {
    if (!navigator.permissions) {
      // Fallback: assume permission not granted
      this.setState({ hasPermission: false });
      return;
    }

    try {
      const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      this.setState({ hasPermission: permission.state === 'granted' });
    } catch (error) {
      // Some browsers don't support camera permission query
      this.setState({ hasPermission: false });
    }
  }

  /**
   * Setup permission watcher for dynamic updates
   */
  private async setupPermissionWatcher(): Promise<void> {
    if (!navigator.permissions) return;

    try {
      this.permissionWatcher = await navigator.permissions.query({ 
        name: 'camera' as PermissionName 
      });

      this.permissionWatcher.addEventListener('change', () => {
        const hasPermission = this.permissionWatcher!.state === 'granted';
        this.setState({ hasPermission });
        this.emit({ type: 'permission-change' });

        // Update devices when permission changes
        if (hasPermission) {
          this.updateDevices().catch(console.warn);
        }
      });
    } catch (error) {
      console.warn('Permission watcher setup failed:', error);
    }
  }

  /**
   * Update available devices
   */
  private async updateDevices(): Promise<void> {
    if (!this.state.hasPermission) return;

    try {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = mediaDevices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
          kind: device.kind as 'videoinput',
          groupId: device.groupId,
        }));

      this.setState({ devices: videoDevices });
      this.emit({ type: 'devices-change', devices: videoDevices });
    } catch (error) {
      console.warn('Failed to enumerate devices:', error);
    }
  }

  /**
   * Update state and notify listeners
   */
  private setState(updates: Partial<CameraState>): void {
    this.state = { ...this.state, ...updates };
  }

  /**
   * Emit event to listeners
   */
  private emit(event: CameraEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Camera event listener error:', error);
      }
    });
  }

  /**
   * Create camera constraints with device selection
   */
  private createConstraints(
    constraints?: Partial<CameraConstraints>, 
    deviceId?: string
  ): MediaStreamConstraints {
    const baseConstraints = { ...DEFAULT_CONSTRAINTS };
    
    if (constraints?.video) {
      baseConstraints.video = { ...baseConstraints.video, ...constraints.video };
    }
    
    if (deviceId) {
      baseConstraints.video.deviceId = deviceId;
    }
    
    return baseConstraints;
  }

  /**
   * Public API
   */

  /**
   * Get current camera state
   */
  getState(): CameraState {
    return { ...this.state };
  }

  /**
   * Request camera permission and stream
   */
  async requestStream(
    constraints?: Partial<CameraConstraints>,
    deviceId?: string
  ): Promise<MediaStream> {
    if (this.state.isRequesting) {
      throw new Error('Camera request already in progress');
    }

    if (!this.state.isAvailable) {
      throw new Error('Camera not supported');
    }

    this.setState({ isRequesting: true, error: null });

    try {
      // Stop existing stream first
      if (this.state.stream) {
        this.stopStream();
      }

      const streamConstraints = this.createConstraints(constraints, deviceId);
      const stream = await navigator.mediaDevices.getUserMedia(streamConstraints);

      this.setState({
        isRequesting: false,
        isStreaming: true,
        hasPermission: true,
        stream,
        activeDeviceId: deviceId || null,
        error: null,
      });

      // Update devices list now that we have permission
      await this.updateDevices();

      this.emit({ type: 'stream-change', stream });
      return stream;

    } catch (error) {
      const errorMessage = this.getErrorMessage(error as Error);
      
      this.setState({
        isRequesting: false,
        isStreaming: false,
        stream: null,
        error: errorMessage,
      });

      this.emit({ type: 'error', error: error as Error });
      throw new Error(errorMessage);
    }
  }

  /**
   * Stop camera stream
   */
  stopStream(): void {
    if (this.state.stream) {
      this.state.stream.getTracks().forEach(track => {
        track.stop();
      });

      this.setState({
        isStreaming: false,
        stream: null,
        activeDeviceId: null,
      });

      this.emit({ type: 'stream-change', stream: undefined });
    }
  }

  /**
   * Switch to a different camera device
   */
  async switchDevice(deviceId: string): Promise<MediaStream> {
    if (!this.state.devices.some(device => device.deviceId === deviceId)) {
      throw new Error('Device not found');
    }

    return this.requestStream(undefined, deviceId);
  }

  /**
   * Check if camera is currently active
   */
  isActive(): boolean {
    return this.state.isStreaming && !!this.state.stream;
  }

  /**
   * Get available camera devices
   */
  getDevices(): CameraDevice[] {
    return [...this.state.devices];
  }

  /**
   * Check camera support for specific constraints
   */
  async checkSupport(constraints: MediaStreamConstraints): Promise<boolean> {
    if (!this.state.isAvailable) return false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get optimal constraints for current device
   */
  getOptimalConstraints(): CameraConstraints {
    // Could be enhanced with device-specific optimizations
    return DEFAULT_CONSTRAINTS;
  }

  /**
   * Add event listener
   */
  addEventListener(listener: (event: CameraEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Convert error to user-friendly message
   */
  private getErrorMessage(error: Error): string {
    if (error.name === 'NotAllowedError') {
      return 'Camera access denied. Please allow camera permissions and try again.';
    }
    if (error.name === 'NotFoundError') {
      return 'No camera found. Please connect a camera and try again.';
    }
    if (error.name === 'NotReadableError') {
      return 'Camera is already in use by another application.';
    }
    if (error.name === 'OverconstrainedError') {
      return 'Camera settings not supported. Trying with different settings.';
    }
    if (error.name === 'SecurityError') {
      return 'Camera access blocked by security policy.';
    }
    return `Camera error: ${error.message || 'Unknown error'}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopStream();
    this.listeners.clear();
    
    if (this.permissionWatcher) {
      this.permissionWatcher.removeEventListener('change', () => {});
      this.permissionWatcher = null;
    }
  }
}

// Singleton instance
export const cameraManager = new CameraManager();