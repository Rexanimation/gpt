import { configureStore } from '@reduxjs/toolkit';
import chatReducer from './chatSlice.js';
import assetReducer from './assetSlice.js';

export const store = configureStore({
    reducer: {
        chat: chatReducer,
        asset: assetReducer
    }
});

export default store;

