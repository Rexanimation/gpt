import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import React from 'react'
import Home from './pages/Home'
import Register from './pages/Register'
import Login from './pages/Login'

const AppRoutes = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path='/'          element={<Home />} />
                <Route path='/register'  element={<Register />} />
                <Route path='/login'     element={<Login />} />
                {/* Catch-all → login */}
                <Route path='*'          element={<Navigate to='/login' replace />} />
            </Routes>
        </BrowserRouter>
    )
}

export default AppRoutes