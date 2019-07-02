import sdk, { ScryptedDeviceBase, DeviceProvider, Settings, Setting, ScryptedDeviceType, VideoCamera, MediaObject } from "@scrypted/sdk";
const { log, deviceManager, mediaManager } = sdk;
var Url = require('url-parse');

class RtspCamera extends ScryptedDeviceBase implements VideoCamera, Settings {

    constructor(nativeId: string) {
        super(nativeId);
    }
    getVideoStream(): MediaObject {
        var u = this.storage.getItem("url");
        if (u == null) {
            return null;
        }
        const url = new Url(u);
        url.username = this.storage.getItem("username")
        url.password = this.storage.getItem("password");

        if (this.storage.getItem("ffmpeg") === 'true') {
            return mediaManager.createFFmpegMediaObject({
                inputArguments: [
                    "-an",
                    "-i",
                    url.toString(),
                    "-reorder_queue_size",
                    "1024",
                    "-max_delay",
                    "2000000",
                ]
            });
        }

        // mime type will be inferred from the rtsp scheme, and null may be passed.
        return mediaManager.createMediaObject(url.toString(), null);
    }
    getSetting(key: string): string | number {
        return this.storage.getItem(key);
    }
    getSettings(): Setting[] {
        console.log('invoked');
        return [
            {
                key: 'url',
                title: 'RTSP Stream URL',
                placeholder: 'rtsp://192.168.1.100:4567/foo/bar',
                value: this.getSetting('url'),
            },
            {
                key: 'username',
                title: 'Username',
                value: this.getSetting('username'),
            },
            {
                key: 'password',
                title: 'Password',
                value: this.getSetting('password'),
            },
            {
                key: 'ffmpeg',
                title: 'Force FFMPEG',
                value: this.getSetting('ffmpeg'),
                description: "Use ffmpeg instead of built in RTSP decoder. Boolean: true or false."
            }
        ];
    }
    putSetting(key: string, value: string | number): void {
        this.storage.setItem(key, value.toString());
    }
}

class RtspProvider extends ScryptedDeviceBase implements DeviceProvider, Settings {
    getSetting(key: string): string | number {
        return null;
    }
    getSettings(): Setting[] {
        return [
            {
                key: 'new-camera',
                title: 'Add RTSP Camera',
                placeholder: 'Camera name, e.g.: Back Yard Camera, Baby Camera, etc',
            }
        ]
    }
    putSetting(key: string, value: string | number): void {
            // generate a random id
        var nativeId = Math.random().toString();
        var name = value.toString();

        deviceManager.onDeviceDiscovered({
            nativeId,
            name: name,
            interfaces: ["VideoCamera", "Settings"],
            type: ScryptedDeviceType.Camera,
        });

        var camera = new RtspCamera(nativeId);
        var text = `New RTSP Camera ${name} ready. Check the notification area to complete setup.`;
        log.a(text);
        log.clearAlert(text);
    }
    discoverDevices(duration: number): void {
    }

    getDevice(nativeId: string): object {
        return new RtspCamera(nativeId);
    }
}

export default new RtspProvider();
