package com.fiberlocator.automedia;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle bundle) {
        super.onCreate(bundle);
        TextView view = new TextView(this);
        view.setText("Fiber Locator Media visibility test");
        view.setTextSize(22);
        int pad = (int) (24 * getResources().getDisplayMetrics().density);
        view.setPadding(pad, pad, pad, pad);
        setContentView(view);
    }
}
