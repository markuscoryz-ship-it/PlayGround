(function () {
  'use strict';

  var solid = function (x, y, w, h) { return { x: x, y: y, w: w, h: h }; };
  var vwall = function (x, y, h) { return { x: x, y: y, w: 18, h: h, wall: true }; };
  var spike = function (x, y, w, h) { return { x: x, y: y, w: w, h: h || 16 }; };
  var crystal = function (x, y) { return { x: x, y: y }; };
  var berry = function (x, y) { return { x: x, y: y }; };

  var levels = [
    {
      name: 'BASE CAMP',
      hint: 'Move with the joystick or A / D. Jump with SPACE. Dash cuts through big gaps.',
      spawn: { x: 58, y: 716 },
      door: { x: 228, y: 38, w: 50, h: 70 },
      solids: [
        solid(0, 752, 480, 48),
        solid(52, 686, 130, 18),
        solid(280, 640, 130, 18),
        solid(104, 580, 126, 18),
        solid(304, 520, 120, 18),
        solid(112, 458, 116, 18),
        solid(292, 398, 116, 18),
        solid(90, 338, 110, 18),
        solid(276, 278, 112, 18),
        solid(142, 218, 116, 18),
        solid(292, 160, 112, 18),
        solid(184, 108, 126, 18),
        vwall(410, 390, 160)
      ],
      spikes: [spike(218, 736, 82)],
      crystals: [crystal(236, 556)],
      berries: [berry(336, 612), berry(144, 430), berry(320, 250)]
    },
    {
      name: 'WINDWARD WALL',
      hint: 'Push into a wall to slow your fall, then jump away. Use the tall walls to climb.',
      spawn: { x: 58, y: 716 },
      door: { x: 228, y: 48, w: 50, h: 70 },
      solids: [
        solid(0, 752, 480, 48),
        solid(48, 690, 132, 18),
        solid(294, 666, 138, 18),
        solid(168, 604, 130, 18),
        solid(56, 542, 110, 18),
        solid(320, 520, 110, 18),
        solid(188, 458, 104, 18),
        solid(330, 398, 100, 18),
        solid(80, 346, 100, 18),
        solid(250, 288, 104, 18),
        solid(148, 228, 104, 18),
        solid(318, 178, 100, 18),
        solid(194, 118, 112, 18),
        vwall(352, 318, 154),
        vwall(104, 374, 138),
        vwall(254, 492, 128),
        solid(426, 566, 54, 18)
      ],
      spikes: [spike(186, 736, 108), spike(344, 502, 64)],
      crystals: [crystal(221, 566), crystal(222, 334)],
      berries: [berry(92, 656), berry(386, 638), berry(122, 516), berry(296, 254)]
    },
    {
      name: 'CRYSTAL HOLLOW',
      hint: 'Long gaps ahead. Dash across them, then touch a crystal to refill your dash.',
      spawn: { x: 58, y: 716 },
      door: { x: 228, y: 46, w: 50, h: 70 },
      solids: [
        solid(0, 752, 480, 48),
        solid(42, 690, 112, 18),
        solid(298, 648, 128, 18),
        solid(88, 588, 110, 18),
        solid(292, 528, 120, 18),
        solid(60, 468, 106, 18),
        solid(284, 408, 108, 18),
        solid(96, 348, 106, 18),
        solid(302, 288, 104, 18),
        solid(122, 228, 104, 18),
        solid(294, 168, 104, 18),
        solid(178, 108, 126, 18),
        solid(10, 638, 18, 114),
        solid(452, 460, 18, 150)
      ],
      spikes: [spike(200, 736, 80), spike(334, 632, 68), spike(128, 572, 52), spike(344, 392, 48)],
      crystals: [crystal(224, 664), crystal(218, 544), crystal(224, 424), crystal(220, 304), crystal(238, 186)],
      berries: [berry(362, 622), berry(92, 440), berry(338, 246), berry(152, 90)]
    },
    {
      name: 'THE SPIRE',
      hint: 'The shaft is narrow. Wall jump from side to side, and save your dash for the last push.',
      spawn: { x: 58, y: 716 },
      door: { x: 228, y: 44, w: 50, h: 72 },
      solids: [
        solid(0, 752, 480, 48),
        solid(46, 692, 96, 18),
        solid(336, 674, 98, 18),
        solid(154, 620, 92, 18),
        solid(272, 562, 88, 18),
        solid(176, 502, 88, 18),
        solid(276, 444, 84, 18),
        solid(168, 384, 86, 18),
        solid(276, 326, 84, 18),
        solid(172, 268, 84, 18),
        solid(274, 210, 82, 18),
        solid(174, 154, 90, 18),
        solid(292, 104, 96, 18),
        solid(190, 148, 18, 360),
        solid(340, 296, 18, 438),
        solid(126, 572, 18, 180),
        solid(286, 640, 18, 112)
      ],
      spikes: [spike(122, 736, 112), spike(250, 736, 106), spike(350, 656, 82)],
      crystals: [crystal(230, 532), crystal(230, 298), crystal(230, 136)],
      berries: [berry(400, 634), berry(128, 478), berry(398, 354), berry(208, 180)]
    },
    {
      name: 'SUMMIT',
      hint: 'One last climb. Chain jumps, wall kicks, and dashes until the sky opens.',
      spawn: { x: 58, y: 716 },
      door: { x: 228, y: 18, w: 50, h: 66 },
      solids: [
        solid(0, 752, 480, 48),
        solid(44, 692, 104, 18),
        solid(286, 680, 112, 18),
        solid(108, 620, 92, 18),
        solid(314, 568, 84, 18),
        solid(184, 538, 98, 18),
        solid(58, 480, 92, 18),
        solid(292, 438, 92, 18),
        solid(160, 390, 90, 18),
        solid(308, 338, 84, 18),
        solid(174, 298, 84, 18),
        solid(66, 250, 86, 18),
        solid(268, 208, 90, 18),
        solid(158, 158, 86, 18),
        solid(300, 118, 92, 18),
        solid(188, 74, 102, 18),
        vwall(382, 272, 122),
        vwall(128, 330, 132),
        solid(22, 594, 18, 100),
        solid(448, 324, 18, 160)
      ],
      spikes: [spike(168, 736, 150), spike(336, 552, 42), spike(238, 422, 54), spike(346, 322, 42), spike(118, 234, 62)],
      crystals: [crystal(220, 660), crystal(226, 506), crystal(236, 362), crystal(222, 226), crystal(240, 108)],
      berries: [berry(72, 656), berry(358, 644), berry(88, 446), berry(388, 410), berry(196, 278)]
    }
  ];

  var themes = [
    {
      skyTop: '#04111d', skyBottom: '#09283b', mountainFar: '#0a2233', mountainNear: '#061725',
      roomTop: '#0a2638', roomBottom: '#071724', rock: '#0b1b2b', rockLight: '#17364a',
      snow: '#d9fbff', accent: '#5be4c5', auroraA: '#5bffd8', auroraB: '#b68cff', haze: '#3e8ca8', sun: '#d9fbff'
    },
    {
      skyTop: '#040c1b', skyBottom: '#0d2946', mountainFar: '#0a2037', mountainNear: '#061426',
      roomTop: '#0b233e', roomBottom: '#071421', rock: '#0b1829', rockLight: '#173952',
      snow: '#e2f4ff', accent: '#74a9ff', auroraA: '#6d9eff', auroraB: '#57e4c1', haze: '#375e96', sun: '#dceaff'
    },
    {
      skyTop: '#0a0618', skyBottom: '#21113b', mountainFar: '#1c1036', mountainNear: '#0c071e',
      roomTop: '#241543', roomBottom: '#100a22', rock: '#170d2b', rockLight: '#34204f',
      snow: '#efddff', accent: '#c092ff', auroraA: '#c18cff', auroraB: '#60e5dc', haze: '#704c9e', sun: '#f2ddff'
    },
    {
      skyTop: '#040817', skyBottom: '#111c3b', mountainFar: '#0d1831', mountainNear: '#060b1c',
      roomTop: '#111f3d', roomBottom: '#070a18', rock: '#0a1122', rockLight: '#21345a',
      snow: '#dff4ff', accent: '#72d9ff', auroraA: '#6cd8ff', auroraB: '#9d8dff', haze: '#3f639c', sun: '#e8f6ff'
    },
    {
      skyTop: '#1b101f', skyBottom: '#4b2636', mountainFar: '#3a1f33', mountainNear: '#1a0f1e',
      roomTop: '#4d2a3b', roomBottom: '#1b101f', rock: '#251323', rockLight: '#563245',
      snow: '#ffe8d3', accent: '#ffb37a', auroraA: '#ff9b71', auroraB: '#ffd36d', haze: '#b55c68', sun: '#ffe0a3'
    }
  ];

  window.AURORA_DATA = { LEVELS: levels, THEMES: themes };
}());
