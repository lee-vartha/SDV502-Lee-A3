const { describe, beforeEach, test } = require('@jest/globals');
const { sendMessage, handleTyping, stopTyping } = require('./script.js');


describe('Chat App', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="messages"></div>
            <div id="online-users"></div>
            <input id="message" />
            <button id="send-message"></button>
                
        `;
    });

        test('sendMessage should send a message to the chat', () => {
            sendMessage('Hello');
            expect(document.getElementById('messages').innerHTML).toBe('<div class="message">Hello</div>');
            
        });

        test('handleTyping should handle what the user is typing out', () => {
            handleTyping();
            expect(document.getElementById('message').classList.contains('typing')).toBe(true);
        });

        test('stopTyping should stop the typing popup to appear', () => {
            stopTyping();
            expect(document.getElementById('message').classList.contains('typing')).toBe(false);
        });

});