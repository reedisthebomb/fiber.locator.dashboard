package com.fiberlocator.automedia;

import android.media.MediaDescription;
import android.media.browse.MediaBrowser;
import android.os.Bundle;
import android.service.media.MediaBrowserService;

import java.util.ArrayList;
import java.util.List;

public class FiberLocatorMediaService extends MediaBrowserService {
    private static final String ROOT_ID = "fiber_locator_root";

    @Override
    public BrowserRoot onGetRoot(String clientPackageName, int clientUid, Bundle rootHints) {
        return new BrowserRoot(ROOT_ID, null);
    }

    @Override
    public void onLoadChildren(String parentId, Result<List<MediaBrowser.MediaItem>> result) {
        List<MediaBrowser.MediaItem> items = new ArrayList<>();
        MediaDescription description = new MediaDescription.Builder()
            .setMediaId("visibility-test")
            .setTitle("Fiber Locator")
            .setSubtitle("Android Auto media visibility test")
            .build();
        items.add(new MediaBrowser.MediaItem(description, MediaBrowser.MediaItem.FLAG_PLAYABLE));
        result.sendResult(items);
    }
}
