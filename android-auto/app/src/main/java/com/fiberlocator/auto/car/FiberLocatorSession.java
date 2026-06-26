package com.fiberlocator.auto.car;

import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.car.app.Screen;
import androidx.car.app.Session;

public class FiberLocatorSession extends Session {
    @NonNull
    @Override
    public Screen onCreateScreen(@NonNull Intent intent) {
        return new CarLiveMapScreen(getCarContext(), null, true);
    }
}
