package nz.ajacombs.wellingtontransitbasemap.names;

import java.util.Map;

import com.onthegomap.planetiler.FeatureCollector;
import com.onthegomap.planetiler.reader.SourceFeature;

import nz.ajacombs.wellingtontransitbasemap.text.FontRegistry;
import nz.ajacombs.wellingtontransitbasemap.text.TextEngine;

public class NeNames {

  private NeNames() {
  }

  public static FeatureCollector.Feature setNeNames(FeatureCollector.Feature feature, SourceFeature sf,
      int minZoom) {
    FontRegistry fontRegistry = FontRegistry.getInstance();

    for (Map.Entry<String, Object> tag : sf.tags().entrySet()) {
      String key = tag.getKey().toString();
      if (sf.getTag(key) == null) {
        continue;
      }
      String value = sf.getTag(key).toString();
      var script = Script.getScript(value);

      if (key.startsWith("name_")) {
        key = key.replace("_", ":");
      }

      if (key.equals("name")) {
        feature.setAttrWithMinzoom("name", value, minZoom);

        if (!script.equals("Latin") && !script.equals("Generic")) {
          feature.setAttrWithMinzoom("script", script, minZoom);
        }

        String encodedValue = TextEngine.encodeRegisteredScripts(value);
        feature.setAttrWithMinzoom("pgf:name", encodedValue, minZoom);
      }

      if (key.startsWith("name:")) {
        feature.setAttrWithMinzoom(key, value, minZoom);

        if (fontRegistry.getScripts().contains(script)) {
          String encodedValue = TextEngine.encodeRegisteredScripts(value);
          feature.setAttrWithMinzoom("pgf:" + key, encodedValue, minZoom);
        }
      }
    }

    return feature;
  }
}