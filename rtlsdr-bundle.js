// node_modules/@jtarrio/webrtlsdr/dist/rtlsdr/rtldevice.js
var DirectSampling;
(function(DirectSampling2) {
  DirectSampling2[DirectSampling2["Off"] = 0] = "Off";
  DirectSampling2[DirectSampling2["I"] = 1] = "I";
  DirectSampling2[DirectSampling2["Q"] = 2] = "Q";
})(DirectSampling || (DirectSampling = {}));

// node_modules/@jtarrio/webrtlsdr/dist/errors.js
var RadioError = class extends Error {
  constructor(message, typeOrOptions, options) {
    super(message, options !== void 0 ? options : typeof typeOrOptions === "object" ? typeOrOptions : void 0);
    if (typeof typeOrOptions === "number") {
      this.type = typeOrOptions;
      this.name = `RadioError.${RadioErrorType[typeOrOptions]}`;
    }
  }
  type;
};
var RadioErrorType;
(function(RadioErrorType2) {
  RadioErrorType2[RadioErrorType2["NoUsbSupport"] = 0] = "NoUsbSupport";
  RadioErrorType2[RadioErrorType2["NoDeviceSelected"] = 1] = "NoDeviceSelected";
  RadioErrorType2[RadioErrorType2["UnsupportedDevice"] = 2] = "UnsupportedDevice";
  RadioErrorType2[RadioErrorType2["UsbTransferError"] = 3] = "UsbTransferError";
  RadioErrorType2[RadioErrorType2["TunerError"] = 4] = "TunerError";
  RadioErrorType2[RadioErrorType2["DemodulationError"] = 5] = "DemodulationError";
})(RadioErrorType || (RadioErrorType = {}));

// node_modules/@jtarrio/webrtlsdr/dist/rtlsdr/r8xx.js
var STD_MUX_CFGS = [
  [0, 8, 2, 223],
  [50, 8, 2, 190],
  [55, 8, 2, 139],
  [60, 8, 2, 123],
  [65, 8, 2, 105],
  [70, 8, 2, 88],
  [75, 0, 2, 68],
  [90, 0, 2, 52],
  [110, 0, 2, 36],
  [140, 0, 2, 20],
  [180, 0, 2, 19],
  [250, 0, 2, 17],
  [280, 0, 2, 0],
  [310, 0, 65, 0],
  [588, 0, 64, 0]
  //      ^       ^^    ^^    ^^^^^^^^
  //      |       ||    ||    ||||++++- LPF (0000: highest)
  //      |       ||    ||    ++++- LPNF (0000: highest)
  //      |       ||    ++- RF filter (00: high, 01: med, 10: low)
  //      |       ++- tracking filter (01: bypass)
  //      +- open drain (1: low Z)
];
var R8xx = class _R8xx {
  com;
  i2c;
  muxCfgs;
  vcoPowerRef;
  /** Frequency of the oscillator crystal. */
  static XTAL_FREQ = 288e5;
  /** Initial values for registers 0x05-0x1f. */
  static REGISTERS = [
    // 0x05
    // [7] loop through off [6] 0 [5] LNA 1 on [4] LNA gain auto [3:0] LNA gain 3
    131,
    // [7] power detector 1 on [6] power detector 3 off [5] filter gain +3dB [4] 1 [3] 0 [2:0] LNA power 2
    50,
    // [7] 0 [6] mixer power on [5] mixer current normal [4] mixer gain auto [3:0] mixer gain 5
    117,
    // 0x08
    // [7] mixer buffer power on [6] mixer buffer low current [5:0] image gain adjustment 0
    192,
    // [7] IF filter off [6] IF filter low current [5:0] image phase adjustment 0
    64,
    // [7] channel filter on [6:5] filter power 2 [4] 1 [3:0] filter bandwidth fine tune 6
    214,
    // [7] 0 [6:5] filter bandwidth coarse tune 3 [4] 0 [3:0] high pass filter corner 12
    108,
    // [7] 1 [6] VGA power on [5] 1 [4] VGA gain controlled by pin [3:0] VGA gain 5.5dB
    245,
    // [7:4] LNA agc power detector threshold high 0.94V [3:0] LNA agc power detector threshold low 0.64V
    99,
    // [7:4] Mixer agc power detector threshold high 1.04V [3:0] Mixer agd power detector threshold low 0.84V
    117,
    // [7] 0 [6:5] LDO 3.0V [4] clock output off [3] 1 [2] 0 [1] internal agc clock on [0] 0
    104,
    // 0x10
    // [7:5] PLL to mixer divider 1:1 [4] PLL divider 1 [3] xtal swing low [2] 1 [1:0] Internal xtal cap (none)
    108,
    // [7:6] PLL analog regulator 2.0V [5] 0 [4] 0 [3] 0 [2] 0 [1] 1 [0] 1
    131,
    // [7] 1 [6:4] 0 [3] ? [2:0] 0
    128,
    // [7:0] 0
    0,
    // [7:6] SI2C = 0 [5:0] NI2C = 15
    15,
    // [7:0] SDM_IN[16:9]
    0,
    // [7:0] SDM_IN[8:1]
    192,
    // [7:6] PLL digital regulator 1.8V, 8mA [5:4] 1 [3] open drain high-Z [2] 1 [1:0] 0
    48,
    // 0x18
    // [7] 0 [6] 1 [5:0] -
    72,
    // [7] RF filter power on [6:5] 0 [4] agc_pin = agc_in [3:2] 1 [1:0] -
    204,
    // [7:6] tracking filter bypass [5] 1 [4] 0 [3:2] PLL auto tune 128kHz [1:0] RF filter highest band
    96,
    // [7:4] highest corner for LPNF [3:0] highest corner for LPF
    0,
    // [7:4] power detector 3 TOP 5 [3] 0 [2] 1 [1] - [0] 0
    84,
    // [7:6] 1 [5:3] power detector 1 TOP 5 [2:0] power detector 2 TOP 6
    174,
    // [7] 0 [6] filter extension enable [5:0] power detector timing control 10
    74,
    // [7:6] 1 [5:2] 0 [1:0] -
    192
  ];
  /** A bit mask to reverse the bits in a byte. */
  static BIT_REVS = [
    0,
    8,
    4,
    12,
    2,
    10,
    6,
    14,
    1,
    9,
    5,
    13,
    3,
    11,
    7,
    15
  ];
  /** This tuner's intermediate frequency. */
  static IF_FREQ = 357e4;
  /** The frequency of the oscillator crystal. */
  xtalFreq;
  /** Whether the PLL in the tuner is locked. */
  hasPllLock;
  /** Shadow registers 0x05-0x1f, for setting values using masks. */
  shadowRegs;
  /**
   * Checks if a R8xx tuner is present.
   */
  static async check(com, i2c) {
    await com.openI2C();
    let found = false;
    try {
      let data = await com.getI2CReg(i2c, 0);
      found = data == 105;
    } catch {
    }
    await com.closeI2C();
    return found;
  }
  /**
   * @param com The RTL communications object.
   * @param i2c The tuner's I2C address.
   * @param muxCfgs The tuner's multiplexer configurations.
   */
  constructor(com, i2c, muxCfgs, vcoPowerRef) {
    this.com = com;
    this.i2c = i2c;
    this.muxCfgs = muxCfgs;
    this.vcoPowerRef = vcoPowerRef;
    this.xtalFreq = _R8xx.XTAL_FREQ;
    this.hasPllLock = false;
    this.shadowRegs = new Uint8Array();
  }
  /**
   * Sets the tuner's frequency.
   * @param freq The frequency to tune to.
   * @returns a promise that resolves to the actual tuned frequency.
   */
  async setFrequency(freq) {
    await this._setMux(freq + _R8xx.IF_FREQ);
    let actual = await this._setPll(freq + _R8xx.IF_FREQ);
    return actual - _R8xx.IF_FREQ;
  }
  /** Starts the tuner. */
  async open() {
    await this.com.setDemodReg(1, 177, 26, 1);
    await this.com.setDemodReg(0, 8, 77, 1);
    await this.com.setDemodReg(1, 21, 1, 1);
    await this.com.openI2C();
    this.shadowRegs = new Uint8Array(_R8xx.REGISTERS);
    for (let i = 0; i < this.shadowRegs.length; ++i) {
      await this.com.setI2CReg(this.i2c, i + 5, this.shadowRegs[i]);
    }
    await this._initElectronics();
    await this.com.closeI2C();
  }
  /** Stops the tuner. */
  async close() {
    await this._writeRegMask(6, 177, 255);
    await this._writeRegMask(5, 179, 255);
    await this._writeRegMask(7, 58, 255);
    await this._writeRegMask(8, 64, 255);
    await this._writeRegMask(9, 192, 255);
    await this._writeRegMask(10, 58, 255);
    await this._writeRegMask(12, 53, 255);
    await this._writeRegMask(15, 104, 255);
    await this._writeRegMask(17, 3, 255);
    await this._writeRegMask(23, 244, 255);
    await this._writeRegMask(25, 12, 255);
  }
  /** Sets the tuner to automatic gain. */
  async setAutoGain() {
    await this._writeRegMask(5, 0, 16);
    await this._writeRegMask(7, 16, 16);
    await this._writeRegMask(12, 11, 159);
  }
  /**
   * Sets the tuner's manual gain.
   * @param gain The tuner's gain, in dB.
   */
  async setManualGain(gain) {
    let fullsteps = Math.floor(gain / 3.5);
    let halfsteps = gain - 3.5 * fullsteps >= 2.3 ? 1 : 0;
    if (fullsteps < 0)
      fullsteps = 0;
    if (fullsteps > 15)
      fullsteps = 15;
    if (fullsteps == 15)
      halfsteps = 0;
    let lnaValue = fullsteps + halfsteps;
    let mixerValue = fullsteps;
    await this._writeRegMask(5, 16, 16);
    await this._writeRegMask(7, 0, 16);
    await this._writeRegMask(12, 8, 159);
    await this._writeRegMask(5, lnaValue, 15);
    await this._writeRegMask(7, mixerValue, 15);
  }
  setXtalFrequency(xtalFreq) {
    this.xtalFreq = xtalFreq;
  }
  getIntermediateFrequency() {
    return _R8xx.IF_FREQ;
  }
  getMinimumFrequency() {
    return _R8xx.XTAL_FREQ;
  }
  /** Calibrates the filters. */
  async _calibrateFilter() {
    let firstTry = true;
    while (true) {
      await this._writeRegMask(11, 96, 96);
      await this._writeRegMask(15, 4, 4);
      await this._writeRegMask(16, 0, 3);
      await this._setPll(56e6);
      if (!this.hasPllLock) {
        throw new RadioError("PLL not locked -- cannot tune to the selected frequency.", RadioErrorType.TunerError);
      }
      await this._writeRegMask(11, 16, 16);
      await this._writeRegMask(11, 0, 16);
      await this._writeRegMask(15, 0, 4);
      let data = await this._readRegBuffer(0, 5);
      let arr = new Uint8Array(data);
      let filterCap = arr[4] & 15;
      if (filterCap == 15) {
        filterCap = 0;
      }
      if (filterCap == 0 || !firstTry) {
        return filterCap;
      }
      firstTry = false;
    }
  }
  /**
   * Sets the multiplexer's frequency.
   * @param freq The frequency to set.
   */
  async _setMux(freq) {
    let freqMhz = freq / 1e6;
    let i;
    for (i = 0; i < this.muxCfgs.length - 1; ++i) {
      if (freqMhz < this.muxCfgs[i + 1][0]) {
        break;
      }
    }
    let cfg = this.muxCfgs[i];
    await this._writeRegMask(23, cfg[1], 8);
    await this._writeRegMask(26, cfg[2], 195);
    await this._writeRegMask(27, cfg[3], 255);
    await this._writeRegMask(16, 0, 11);
    await this._writeRegMask(8, 0, 63);
    await this._writeRegMask(9, 0, 63);
  }
  /**
   * Sets the PLL's frequency.
   * @param freq The frequency to set.
   * @returns a promise that resolves to the actual frequency set, or to 0 if the frequency is not achievable.
   */
  async _setPll(freq) {
    let pllRef = Math.floor(this.xtalFreq);
    await this._writeRegMask(16, 0, 16);
    await this._writeRegMask(26, 0, 12);
    await this._writeRegMask(18, 128, 224);
    let divNum = Math.min(6, Math.floor(Math.log(177e7 / freq) / Math.LN2));
    let mixDiv = 1 << divNum + 1;
    let data = await this._readRegBuffer(0, 5);
    let arr = new Uint8Array(data);
    let vcoFineTune = (arr[4] & 48) >> 4;
    if (vcoFineTune > this.vcoPowerRef) {
      --divNum;
    } else if (vcoFineTune < this.vcoPowerRef) {
      ++divNum;
    }
    await this._writeRegMask(16, divNum << 5, 224);
    let vcoFreq = freq * mixDiv;
    let nint = Math.floor(vcoFreq / (2 * pllRef));
    let vcoFra = vcoFreq % (2 * pllRef);
    if (nint > 63) {
      this.hasPllLock = false;
      return 0;
    }
    let ni = Math.floor((nint - 13) / 4);
    let si = (nint - 13) % 4;
    await this._writeRegMask(20, ni + (si << 6), 255);
    await this._writeRegMask(18, vcoFra == 0 ? 8 : 0, 8);
    let sdm = Math.min(65535, Math.floor(32768 * vcoFra / pllRef));
    await this._writeRegMask(22, sdm >> 8, 255);
    await this._writeRegMask(21, sdm & 255, 255);
    await this._getPllLock();
    await this._writeRegMask(26, 8, 8);
    return 2 * pllRef * (nint + sdm / 65536) / mixDiv;
  }
  /**
   * Checks whether the PLL has achieved lock.
   * @param firstTry Whether this is the first try to achieve lock.
   */
  async _getPllLock() {
    let firstTry = true;
    while (true) {
      let data = await this._readRegBuffer(0, 3);
      let arr = new Uint8Array(data);
      if (arr[2] & 64) {
        this.hasPllLock = true;
        return;
      }
      if (!firstTry) {
        this.hasPllLock = true;
        return;
      }
      await this._writeRegMask(18, 96, 224);
      firstTry = false;
    }
  }
  /** Initializes all the components of the tuner. */
  async _initElectronics() {
    await this._writeRegMask(12, 0, 15);
    await this._writeRegMask(19, 49, 63);
    await this._writeRegMask(29, 0, 56);
    let filterCap = await this._calibrateFilter();
    await this._writeRegMask(10, 16 | filterCap, 31);
    await this._writeRegMask(11, 107, 239);
    await this._writeRegMask(7, 0, 128);
    await this._writeRegMask(6, 16, 48);
    await this._writeRegMask(30, 64, 96);
    await this._writeRegMask(5, 0, 128);
    await this._writeRegMask(31, 0, 128);
    await this._writeRegMask(15, 0, 128);
    await this._writeRegMask(25, 96, 96);
    await this._writeRegMask(29, 229, 199);
    await this._writeRegMask(28, 36, 248);
    await this._writeRegMask(13, 83, 255);
    await this._writeRegMask(14, 117, 255);
    await this._writeRegMask(5, 0, 96);
    await this._writeRegMask(6, 0, 8);
    await this._writeRegMask(17, 56, 8);
    await this._writeRegMask(23, 48, 48);
    await this._writeRegMask(10, 64, 96);
    await this._writeRegMask(29, 0, 56);
    await this._writeRegMask(28, 0, 4);
    await this._writeRegMask(6, 0, 64);
    await this._writeRegMask(26, 48, 48);
    await this._writeRegMask(29, 24, 56);
    await this._writeRegMask(28, 36, 4);
    await this._writeRegMask(30, 13, 31);
    await this._writeRegMask(26, 32, 48);
  }
  /**
   * Reads a series of registers into a buffer.
   * @param addr The first register's address to read.
   * @param length The number of registers to read.
   * @returns a promise that resolves to an ArrayBuffer with the data.
   */
  async _readRegBuffer(addr, length) {
    let data = await this.com.getI2CRegBuffer(this.i2c, addr, length);
    let buf = new Uint8Array(data);
    for (let i = 0; i < buf.length; ++i) {
      let b = buf[i];
      buf[i] = _R8xx.BIT_REVS[b & 15] << 4 | _R8xx.BIT_REVS[b >> 4];
    }
    return buf.buffer;
  }
  /**
   * Writes a masked value into a register.
   * @param addr The address of the register to write into.
   * @param value The value to write.
   * @param mask A mask that specifies which bits to write.
   */
  async _writeRegMask(addr, value, mask) {
    let rc = this.shadowRegs[addr - 5];
    let val = rc & ~mask | value & mask;
    this.shadowRegs[addr - 5] = val;
    await this.com.setI2CReg(this.i2c, addr, val);
  }
};

// node_modules/@jtarrio/webrtlsdr/dist/rtlsdr/r820t.js
var R820T = class _R820T extends R8xx {
  /**
   * Initializes the R820T tuner, if present.
   * @param com The RTL communications object.
   * @returns a promise that resolves to the tuner, or null if not present.
   */
  static async maybeInit(com) {
    let found = await R8xx.check(com, 52);
    if (!found)
      return null;
    let tuner = new _R820T(com);
    await tuner.open();
    return tuner;
  }
  /**
   * @param com The RTL communications object.
   * @param xtalFreq The frequency of the oscillator crystal.
   */
  constructor(com) {
    super(com, 52, STD_MUX_CFGS, 2);
  }
};

// node_modules/@jtarrio/webrtlsdr/dist/rtlsdr/r828d.js
var R828D = class _R828D extends R8xx {
  isRtlSdrBlogV4;
  /** Current input; 0=air, 1=cable1, 2=cable2. */
  input;
  /**
   * Initializes the R828D tuner, if present.
   * @param com The RTL communications object.
   * @returns a promise that resolves to the tuner, or null if not present.
   */
  static async maybeInit(com) {
    let found = R8xx.check(com, 116);
    if (!found)
      return null;
    let { manufacturer, model } = com.getBranding();
    let isRtlSdrBlogV4 = manufacturer == "RTLSDRBlog" && model == "Blog V4";
    let tuner = new _R828D(com, isRtlSdrBlogV4);
    await tuner.open();
    return tuner;
  }
  /**
   * @param com The RTL communications object.
   * @param xtalFreq The frequency of the oscillator crystal.
   */
  constructor(com, isRtlSdrBlogV4) {
    super(com, 116, isRtlSdrBlogV4 ? MUX_CFGS_RTLSDRBLOGV4 : STD_MUX_CFGS, 1);
    this.isRtlSdrBlogV4 = isRtlSdrBlogV4;
    this.input = 0;
  }
  /**
   * Sets the tuner's frequency.
   * @param freq The frequency to tune to.
   * @returns a promise that resolves to the actual tuned frequency.
   */
  async setFrequency(freq) {
    let upconvert = 0;
    if (this.isRtlSdrBlogV4 && freq < 288e5) {
      upconvert = 288e5;
    }
    let actual = await super.setFrequency(freq + upconvert);
    if (this.isRtlSdrBlogV4) {
      let input = freq <= 288e5 ? 2 : freq < 25e7 ? 1 : 0;
      if (this.input != input) {
        this.input = input;
        if (input == 0) {
          await this._writeRegMask(6, 0, 8);
          await this._writeRegMask(5, 0, 96);
        } else if (input == 1) {
          await this._writeRegMask(6, 0, 8);
          await this._writeRegMask(5, 96, 96);
        } else {
          await this._writeRegMask(6, 8, 8);
          await this._writeRegMask(5, 32, 96);
        }
        await this.com.setGpioOutput(5);
        await this.com.setGpioBit(5, input == 2 ? 0 : 1);
      }
    } else {
      let input = freq > 345e6 ? 0 : 1;
      if (this.input != input) {
        this.input = input;
        await this._writeRegMask(5, input == 0 ? 0 : 96, 96);
      }
    }
    return actual - upconvert;
  }
  getMinimumFrequency() {
    return this.isRtlSdrBlogV4 ? 0 : super.getMinimumFrequency();
  }
};
var MUX_CFGS_RTLSDRBLOGV4 = [
  [0, 0, 2, 223],
  [2.2, 8, 2, 223],
  [50, 8, 2, 190],
  [55, 8, 2, 139],
  [60, 8, 2, 123],
  [65, 8, 2, 105],
  [70, 8, 2, 88],
  [75, 8, 2, 68],
  [85, 0, 2, 68],
  [90, 0, 2, 52],
  [110, 0, 2, 36],
  [112, 8, 2, 36],
  [140, 8, 2, 20],
  [172, 0, 2, 20],
  [180, 0, 2, 19],
  [242, 8, 2, 19],
  [250, 8, 2, 17],
  [280, 8, 2, 0],
  [310, 8, 65, 0],
  [588, 8, 64, 0]
  //      ^       ^^    ^^    ^^^^^^^^
  //      |       ||    ||    ||||++++- LPF (0000: highest)
  //      |       ||    ||    ++++- LPNF (0000: highest)
  //      |       ||    ++- RF filter (00: high, 01: med, 10: low)
  //      |       ++- tracking filter (01: bypass)
  //      +- open drain (1: low Z)
];

// node_modules/@jtarrio/webrtlsdr/dist/rtlsdr/rtlcom.js
var RtlCom = class _RtlCom {
  constructor(device) {
    this.device = device;
  }
  device;
  /** Set in the control messages' index field for write operations. */
  static WRITE_FLAG = 16;
  /** Claims the USB control interface. */
  async claimInterface() {
    try {
      await this.device.claimInterface(0);
    } catch (e) {
      throw new RadioError("Could not connect to the RTL-SDR stick. Are you using it in another application?", RadioErrorType.UsbTransferError, { cause: e });
    }
  }
  /** Releases the USB control interface. */
  async releaseInterface() {
    await this.device.releaseInterface(0);
  }
  /** Returns branding information. */
  getBranding() {
    return {
      manufacturer: this.device.manufacturerName,
      model: this.device.productName
    };
  }
  /**
   * Writes to a USB control register.
   * @param address The register's address.
   * @param value The value to write.
   * @param length The number of bytes this value uses.
   */
  async setUsbReg(address, value, length) {
    await this._setReg(256, address, value, length);
  }
  /**
   * Writes to a 8051 system register.
   * @param address The register's address.
   * @param value The value to write.
   */
  async setSysReg(address, value) {
    await this._setReg(512, address, value, 1);
  }
  /**
   * Reads from a 8051 system register.
   * @param address The register's address.
   * @returns The value that was read.
   */
  async getSysReg(address) {
    return this._getReg(512, address, 1);
  }
  /**
   * Writes a value into a demodulator register.
   * @param page The register page number.
   * @param addr The register's address.
   * @param value The value to write.
   * @param len The width in bytes of this value.
   * @returns a promise that resolves the value that was read back from the register.
   */
  async setDemodReg(page, addr, value, len) {
    await this._setRegBuffer(page, addr << 8 | 32, this._numberToBuffer(value, len, true));
    return this._getReg(10, 288, 1);
  }
  /**
   * Reads a value from an I2C register.
   * @param addr The device's address.
   * @param reg The register number.
   * @returns a promise that resolves to the value in the register.
   */
  async getI2CReg(addr, reg) {
    await this._setRegBuffer(1536, addr, new Uint8Array([reg]).buffer);
    return this._getReg(1536, addr, 1);
  }
  /**
   * Writes a value to an I2C register.
   * @param addr The device's address.
   * @param reg The register number.
   * @param value The value to write.
   */
  async setI2CReg(addr, reg, value) {
    await this._setRegBuffer(1536, addr, new Uint8Array([reg, value]).buffer);
  }
  /**
   * Reads a buffer from an I2C register.
   * @param addr The device's address.
   * @param reg The register number.
   * @param len The number of bytes to read.
   * @returns a promise that resolves to the read buffer.
   */
  async getI2CRegBuffer(addr, reg, len) {
    await this._setRegBuffer(1536, addr, new Uint8Array([reg]).buffer);
    return this._getRegBuffer(1536, addr, len);
  }
  async setGpioOutput(gpio) {
    gpio = 1 << gpio;
    let r = await this.getSysReg(12292);
    await this.setSysReg(12292, r & ~gpio);
    r = await this.getSysReg(12291);
    await this.setSysReg(12291, r | gpio);
  }
  async setGpioBit(gpio, val) {
    gpio = 1 << gpio;
    let r = await this.getSysReg(12289);
    r = val ? r | gpio : r & ~gpio;
    await this.setSysReg(12289, r);
  }
  /**
   * Does a bulk transfer from the device.
   * @param length The number of bytes to read.
   * @returns a promise that resolves to the data that was read.
   */
  async getSamples(length) {
    let result = await this.device.transferIn(1, length);
    if (result.status == "ok")
      return result.data.buffer;
    if (result.status == "stall") {
      await this.device.clearHalt("in", 1);
      return new ArrayBuffer(length);
    }
    throw new RadioError(`USB bulk read failed length 0x${length.toString(16)} status=${result.status}`, RadioErrorType.UsbTransferError);
  }
  /**
   * Opens the I2C repeater.
   * To avoid interference, the tuner is usually disconnected from the I2C bus.
   * With the repeater open, the tuner can receive I2C messages.
   */
  async openI2C() {
    await this.setDemodReg(1, 1, 24, 1);
  }
  /** Closes the I2C repeater. */
  async closeI2C() {
    await this.setDemodReg(1, 1, 16, 1);
  }
  /** Closes the connection. */
  async close() {
    await this.device.close();
  }
  /**
   * Writes a value into a dongle's register.
   * @param block The register's block number.
   * @param reg The register number.
   * @param value The value to write.
   * @param length The width in bytes of this value.
   */
  async _setReg(block, reg, value, length) {
    try {
      await this._writeCtrlMsg(reg, block | _RtlCom.WRITE_FLAG, this._numberToBuffer(value, length));
    } catch (e) {
      throw new RadioError(`setReg failed block=0x${block.toString(16)} reg=${reg.toString(16)} value=${value.toString(16)} length=${length}`, RadioErrorType.UsbTransferError, { cause: e });
    }
  }
  /**
   * Reads a value from a dongle's register.
   * @param block The register's block number.
   * @param reg The register number.
   * @param length The width in bytes of the value to read.
   * @returns a promise that resolves to the decoded value.
   */
  async _getReg(block, reg, length) {
    try {
      return this._bufferToNumber(await this._readCtrlMsg(reg, block, length));
    } catch (e) {
      throw new RadioError(`getReg failed block=0x${block.toString(16)} reg=${reg.toString(16)} length=${length}`, RadioErrorType.UsbTransferError, { cause: e });
    }
  }
  /**
   * Writes a buffer into a dongle's register.
   * @param block The register's block number.
   * @param reg The register number.
   * @param buffer The buffer to write.
   */
  async _setRegBuffer(block, reg, buffer) {
    try {
      await this._writeCtrlMsg(reg, block | _RtlCom.WRITE_FLAG, buffer);
    } catch (e) {
      throw new RadioError(`setRegBuffer failed block=0x${block.toString(16)} reg=${reg.toString(16)}`, RadioErrorType.UsbTransferError, { cause: e });
    }
  }
  /**
   * Reads a buffer from a dongle's register.
   * @param block The register's block number.
   * @param reg The register number.
   * @param length The length in bytes of the buffer to read.
   * @returns a Promise that resolves to the read buffer.
   */
  async _getRegBuffer(block, reg, length) {
    try {
      return this._readCtrlMsg(reg, block, length);
    } catch (e) {
      throw new RadioError(`getRegBuffer failed block=0x${block.toString(16)} reg=${reg.toString(16)} length=${length}`, RadioErrorType.UsbTransferError, { cause: e });
    }
  }
  /**
   * Decodes a buffer as a little-endian number.
   * @param buffer The buffer to decode.
   * @returns The decoded number.
   */
  _bufferToNumber(buffer) {
    let len = buffer.byteLength;
    let dv = new DataView(buffer);
    if (len == 0) {
      return 0;
    } else if (len == 1) {
      return dv.getUint8(0);
    } else if (len == 2) {
      return dv.getUint16(0, true);
    } else if (len == 4) {
      return dv.getUint32(0, true);
    }
    throw new RadioError(`Cannot parse ${len}-byte number`, RadioErrorType.UsbTransferError);
  }
  /**
   * Encodes a number into a buffer.
   * @param value The number to encode.
   * @param len The number of bytes to encode into.
   * @param opt_bigEndian Whether to use a big-endian encoding.
   */
  _numberToBuffer(value, len, opt_bigEndian) {
    let buffer = new ArrayBuffer(len);
    let dv = new DataView(buffer);
    if (len == 1) {
      dv.setUint8(0, value);
    } else if (len == 2) {
      dv.setUint16(0, value, !opt_bigEndian);
    } else if (len == 4) {
      dv.setUint32(0, value, !opt_bigEndian);
    } else {
      throw new RadioError(`Cannot write ${len}-byte number`, RadioErrorType.UsbTransferError);
    }
    return buffer;
  }
  /**
   * Sends a USB control message to read from the device.
   * @param value The value field of the control message.
   * @param index The index field of the control message.
   * @param length The number of bytes to read.
   * @returns a promise that resolves to the read buffer.
   */
  async _readCtrlMsg(value, index, length) {
    let ti = {
      requestType: "vendor",
      recipient: "device",
      request: 0,
      value,
      index
    };
    let result = await this.device.controlTransferIn(ti, Math.max(8, length));
    if (result.status == "ok")
      return result.data.buffer.slice(0, length);
    throw new RadioError(`USB read failed value=0x${value.toString(16)} index=0x${index.toString(16)} status=${result.status}`, RadioErrorType.UsbTransferError);
  }
  /**
   * Sends a USB control message to write to the device.
   * @param value The value field of the control message.
   * @param index The index field of the control message.
   * @param buffer The buffer to write to the device.
   */
  async _writeCtrlMsg(value, index, buffer) {
    let ti = {
      requestType: "vendor",
      recipient: "device",
      request: 0,
      value,
      index
    };
    let result = await this.device.controlTransferOut(ti, buffer);
    if (result.status == "ok")
      return;
    throw new RadioError(`USB write failed value=0x${value.toString(16)} index=0x${index.toString(16)} status=${result.status}`, RadioErrorType.UsbTransferError);
  }
};

// node_modules/@jtarrio/webrtlsdr/dist/rtlsdr/rtl2832u.js
var TUNERS = [
  { vendorId: 3034, productId: 10290 },
  { vendorId: 3034, productId: 10296 }
];
var RTL2832U_Provider = class {
  constructor() {
    this.device = void 0;
  }
  device;
  async get() {
    if (this.device === void 0) {
      this.device = await this.getDevice();
    }
    await this.device.open();
    return RTL2832U.open(this.device);
  }
  async getDevice() {
    if (navigator.usb === void 0) {
      throw new RadioError(`This browser does not support the HTML5 USB API`, RadioErrorType.NoUsbSupport);
    }
    try {
      return navigator.usb.requestDevice({ filters: TUNERS });
    } catch (e) {
      throw new RadioError(`No device was selected`, RadioErrorType.NoDeviceSelected, { cause: e });
    }
  }
};
var RTL2832U = class _RTL2832U {
  com;
  tuner;
  /** Frequency of the oscillator crystal. */
  static XTAL_FREQ = 288e5;
  /** The number of bytes for each sample. */
  static BYTES_PER_SAMPLE = 2;
  constructor(com, tuner) {
    this.com = com;
    this.tuner = tuner;
    this.centerFrequency = 0;
    this.ppm = 0;
    this.gain = null;
    this.directSamplingMethod = DirectSampling.Off;
    this.directSampling = DirectSampling.Off;
    this.biasTeeEnabled = false;
  }
  centerFrequency;
  ppm;
  gain;
  directSamplingMethod;
  directSampling;
  biasTeeEnabled;
  /**
   * Initializes the demodulator.
   * @param device The USB device.
   */
  static async open(device) {
    let com = new RtlCom(device);
    await com.claimInterface();
    await _RTL2832U._init(com);
    let tuner = await _RTL2832U._findTuner(com);
    let rtl = new _RTL2832U(com, tuner);
    await rtl.setGain(rtl.gain);
    await rtl.setFrequencyCorrection(rtl.ppm);
    return rtl;
  }
  static async _init(com) {
    await com.setUsbReg(8192, 9, 1);
    await com.setUsbReg(8536, 512, 2);
    await com.setUsbReg(8520, 528, 2);
    await com.setSysReg(12299, 34);
    await com.setSysReg(12288, 232);
    await com.setDemodReg(1, 1, 20, 1);
    await com.setDemodReg(1, 1, 16, 1);
    await com.setDemodReg(1, 21, 0, 1);
    await com.setDemodReg(1, 22, 0, 1);
    await com.setDemodReg(1, 23, 0, 1);
    await com.setDemodReg(1, 24, 0, 1);
    await com.setDemodReg(1, 25, 0, 1);
    await com.setDemodReg(1, 26, 0, 1);
    await com.setDemodReg(1, 27, 0, 1);
    await com.setDemodReg(1, 28, 202, 1);
    await com.setDemodReg(1, 29, 220, 1);
    await com.setDemodReg(1, 30, 215, 1);
    await com.setDemodReg(1, 31, 216, 1);
    await com.setDemodReg(1, 32, 224, 1);
    await com.setDemodReg(1, 33, 242, 1);
    await com.setDemodReg(1, 34, 14, 1);
    await com.setDemodReg(1, 35, 53, 1);
    await com.setDemodReg(1, 36, 6, 1);
    await com.setDemodReg(1, 37, 80, 1);
    await com.setDemodReg(1, 38, 156, 1);
    await com.setDemodReg(1, 39, 13, 1);
    await com.setDemodReg(1, 40, 113, 1);
    await com.setDemodReg(1, 41, 17, 1);
    await com.setDemodReg(1, 42, 20, 1);
    await com.setDemodReg(1, 43, 113, 1);
    await com.setDemodReg(1, 44, 116, 1);
    await com.setDemodReg(1, 45, 25, 1);
    await com.setDemodReg(1, 46, 65, 1);
    await com.setDemodReg(1, 47, 165, 1);
    await com.setDemodReg(0, 25, 5, 1);
    await com.setDemodReg(1, 147, 240, 1);
    await com.setDemodReg(1, 148, 15, 1);
    await com.setDemodReg(1, 17, 0, 1);
    await com.setDemodReg(1, 4, 0, 1);
    await com.setDemodReg(0, 97, 96, 1);
    await com.setDemodReg(0, 6, 128, 1);
    await com.setDemodReg(1, 177, 27, 1);
    await com.setDemodReg(0, 13, 131, 1);
  }
  /** Finds the tuner that's connected to this demodulator and returns the appropriate instance. */
  static async _findTuner(com) {
    let tuner = await R820T.maybeInit(com);
    if (tuner === null)
      tuner = await R828D.maybeInit(com);
    if (tuner === null) {
      await com.releaseInterface();
      throw new RadioError("Sorry, your USB dongle has an unsupported tuner chip.", RadioErrorType.UnsupportedDevice);
    }
    return tuner;
  }
  /**
   * Set the sample rate.
   * @param rate The sample rate, in samples/sec.
   * @returns a promise that resolves to the sample rate that was actually set.
   */
  async setSampleRate(rate) {
    let ratio = Math.floor(this._getXtalFrequency() * (1 << 22) / rate);
    ratio &= 268435452;
    let realRate = Math.floor(this._getXtalFrequency() * (1 << 22) / ratio);
    await this.com.setDemodReg(1, 159, ratio >> 16 & 65535, 2);
    await this.com.setDemodReg(1, 161, ratio & 65535, 2);
    await this._resetDemodulator();
    return realRate;
  }
  async setFrequencyCorrection(ppm) {
    this.ppm = ppm;
    let ppmOffset = -1 * Math.floor(this.ppm * (1 << 24) / 1e6);
    await this.com.setDemodReg(1, 62, ppmOffset >> 8 & 63, 1);
    await this.com.setDemodReg(1, 63, ppmOffset & 255, 1);
    let xtalFrequency = this._getXtalFrequency();
    this.tuner.setXtalFrequency(xtalFrequency);
    let ifFreq = this.tuner.getIntermediateFrequency();
    if (ifFreq != 0) {
      await this._setIfFrequency(ifFreq);
    }
    if (this.centerFrequency != 0) {
      await this.setCenterFrequency(this.centerFrequency);
    }
  }
  async _setIfFrequency(ifFreq) {
    let xtalFrequency = this._getXtalFrequency();
    let multiplier = -1 * Math.floor(ifFreq * (1 << 22) / xtalFrequency);
    await this.com.setDemodReg(1, 25, multiplier >> 16 & 63, 1);
    await this.com.setDemodReg(1, 26, multiplier >> 8 & 255, 1);
    await this.com.setDemodReg(1, 27, multiplier & 255, 1);
    return Math.floor(-1 * multiplier * xtalFrequency / (1 << 22));
  }
  getFrequencyCorrection() {
    return this.ppm;
  }
  async setGain(gain) {
    this.gain = gain;
    await this.com.openI2C();
    if (this.directSampling) {
      this._enableRtlAgc(gain == null);
    } else if (this.gain === null) {
      await this.tuner.setAutoGain();
    } else {
      await this.tuner.setManualGain(this.gain);
    }
    await this.com.closeI2C();
  }
  getGain() {
    return this.gain;
  }
  async enableBiasTee(enabled) {
    this.biasTeeEnabled = enabled;
    await this.com.setGpioOutput(0);
    await this.com.setGpioBit(0, enabled ? 1 : 0);
  }
  isBiasTeeEnabled() {
    return this.biasTeeEnabled;
  }
  async _enableRtlAgc(enable) {
    await this.com.setDemodReg(0, 25, enable ? 37 : 5, 1);
  }
  _getXtalFrequency() {
    return Math.floor(_RTL2832U.XTAL_FREQ * (1 + this.ppm / 1e6));
  }
  /** Resets the demodulator. */
  async _resetDemodulator() {
    await this.com.setDemodReg(1, 1, 20, 1);
    await this.com.setDemodReg(1, 1, 16, 1);
  }
  /**
   * Tunes the device to the given frequency.
   * @param freq The frequency to tune to, in Hertz.
   * @returns a promise that resolves to the actual tuned frequency.
   */
  async setCenterFrequency(freq) {
    await this._maybeSetDirectSampling(freq);
    let actualFreq;
    if (this.directSampling) {
      actualFreq = this._setIfFrequency(freq);
    } else {
      await this.com.openI2C();
      actualFreq = await this.tuner.setFrequency(freq);
      await this.com.closeI2C();
    }
    this.centerFrequency = freq;
    return actualFreq;
  }
  /**
   * Sets the method used for direct sampling mode, or disables it.
   * If enabled, the radio will enter direct sampling mode for low frequencies.
   */
  async setDirectSamplingMethod(method) {
    if (this.directSamplingMethod == method)
      return;
    this.directSamplingMethod = method;
    if (this.centerFrequency != 0) {
      await this.setCenterFrequency(this.centerFrequency);
    }
  }
  /** Returns the current direct sampling method. */
  getDirectSamplingMethod() {
    return this.directSamplingMethod;
  }
  async _maybeSetDirectSampling(frequency) {
    let lowFrequency = frequency < this.tuner.getMinimumFrequency();
    let method = lowFrequency ? this.directSamplingMethod : DirectSampling.Off;
    if (this.directSampling == method)
      return;
    const tunerWasOn = this.directSampling == DirectSampling.Off;
    const useDirectSampling = method != DirectSampling.Off;
    this.directSampling = method;
    if (useDirectSampling) {
      if (tunerWasOn) {
        await this.com.openI2C();
        await this.tuner.close();
        await this.com.closeI2C();
      }
      await this.com.setDemodReg(1, 177, 26, 1);
      await this.com.setDemodReg(1, 21, 0, 1);
      let regValue = method == DirectSampling.I ? 128 : 144;
      await this.com.setDemodReg(0, 6, regValue, 1);
      await this._enableRtlAgc(true);
    } else {
      await this.com.openI2C();
      await this.tuner.open();
      await this.com.closeI2C();
      let ifFreq = this.tuner.getIntermediateFrequency();
      if (ifFreq != 0) {
        await this._setIfFrequency(ifFreq);
      }
      await this.com.setDemodReg(1, 21, 1, 1);
      await this.com.setDemodReg(0, 6, 128, 1);
      await this._enableRtlAgc(false);
      await this.setGain(this.getGain());
    }
  }
  /** Resets the sample buffer. Call this before starting to read samples. */
  async resetBuffer() {
    await this.com.setUsbReg(8520, 528, 2);
    await this.com.setUsbReg(8520, 0, 2);
  }
  /**
   * Reads a block of samples off the device.
   * @param length The number of samples to read.
   * @returns a promise that resolves to a SampleBlock.
   */
  async readSamples(length) {
    const data = await this.com.getSamples(length * _RTL2832U.BYTES_PER_SAMPLE);
    const frequency = this.centerFrequency;
    const directSampling = this.directSampling != DirectSampling.Off;
    return { frequency, directSampling, data };
  }
  /** Stops the demodulator. */
  async close() {
    await this.com.openI2C();
    await this.tuner.close();
    await this.com.closeI2C();
    await this.com.releaseInterface();
    await this.com.close();
  }
};
export {
  RTL2832U_Provider
};
