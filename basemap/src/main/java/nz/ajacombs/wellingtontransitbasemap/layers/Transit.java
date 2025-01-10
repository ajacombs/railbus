package nz.ajacombs.wellingtontransitbasemap.layers;

import java.util.List;

import com.onthegomap.planetiler.FeatureCollector;
import com.onthegomap.planetiler.ForwardingProfile;
import com.onthegomap.planetiler.VectorTile;
import com.onthegomap.planetiler.reader.SourceFeature;

public class Transit implements ForwardingProfile.LayerPostProcesser {

  @Override
  public String name() {
    return "transit";
  }

  public void processOsm(SourceFeature sf, FeatureCollector features) {
  }

  @Override
  public List<VectorTile.Feature> postProcess(int zoom, List<VectorTile.Feature> items) {
    return items;
  }
}
