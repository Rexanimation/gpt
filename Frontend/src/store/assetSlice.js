import { createSlice } from '@reduxjs/toolkit';

const assetSlice = createSlice({
    name: 'asset',
    initialState: {
        files: [],
        activeAssetContext: null,
        uploading: false,
        analysisProgress: 0,
        analysisStatus: 'idle', // 'idle' | 'analyzing' | 'completed' | 'failed'
    },
    reducers: {
        setFiles(state, action) {
            state.files = action.payload;
        },
        addFile(state, action) {
            state.files.unshift(action.payload);
        },
        removeFile(state, action) {
            state.files = state.files.filter(f => f._id !== action.payload);
            if (state.activeAssetContext && state.activeAssetContext._id === action.payload) {
                state.activeAssetContext = null;
                state.analysisStatus = 'idle';
                state.analysisProgress = 0;
            }
        },
        updateFile(state, action) {
            const index = state.files.findIndex(f => f._id === action.payload._id);
            if (index !== -1) {
                state.files[index] = action.payload;
            }
            if (state.activeAssetContext && state.activeAssetContext._id === action.payload._id) {
                state.activeAssetContext = action.payload;
            }
        },
        setActiveAssetContext(state, action) {
            state.activeAssetContext = action.payload;
        },
        setUploading(state, action) {
            state.uploading = action.payload;
        },
        setAnalysisProgress(state, action) {
            state.analysisProgress = action.payload;
        },
        setAnalysisStatus(state, action) {
            state.analysisStatus = action.payload;
        }
    }
});

export const {
    setFiles,
    addFile,
    removeFile,
    updateFile,
    setActiveAssetContext,
    setUploading,
    setAnalysisProgress,
    setAnalysisStatus
} = assetSlice.actions;

export default assetSlice.reducer;
