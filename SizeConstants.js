// Fixed size constants
(function(global) {
    'use strict';
    const SIZE_CONSTANTS = {
        SIZE_SMALL: 0,
        SIZE_MEDIUM: 1,
        SIZE_LARGE: 2,
    };
    const SIZE_NAMES = {
        0: 'SIZE_SMALL',
        1: 'SIZE_MEDIUM',
        2: 'SIZE_LARGE',
    };
    const SIZE_LIST = ['Small', 'Medium', 'Large'];
    global.SIZE_CONSTANTS = SIZE_CONSTANTS;
    global.SIZE_NAMES = SIZE_NAMES;
    global.SIZE_LIST = SIZE_LIST;
    console.log('[SizeConstants] ✅ 已加载');
})(window);