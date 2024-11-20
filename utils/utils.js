/**
 * 等待
 * @param {*} seconds 秒
 * @returns 
 */
const sleep = (seconds) => {
    const milliseconds = seconds * 1000;
    return new Promise(resolve => setTimeout(resolve, milliseconds));
};
export { sleep };