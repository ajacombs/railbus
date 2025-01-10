package nz.ajacombs.wellingtontransitbasemap.feature;

import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.util.zip.GZIPInputStream;

import javax.annotation.concurrent.Immutable;

import com.carrotsearch.hppc.LongLongHashMap;

/**
 * An in-memory representation of the entire QRank database used for
 * generalizing
 * {@link nz.ajacombs.wellingtontransitbasemap.layers.Pois}.
 * <p>
 * Parses a copy of the gzipped QRank dataset into a long->long hash map that
 * can be efficiently queried when processing
 * POI features.
 **/
@Immutable
public final class QrankDb {

  private final LongLongHashMap db;

  public QrankDb(LongLongHashMap db) {
    this.db = db;
  }

  public long get(long wikidataId) {
    return this.db.get(wikidataId);
  }

  public long get(String osmValue) {
    try {
      if (osmValue.contains(";")) {
        osmValue = osmValue.split(";")[0];
      }
      long id = Long.parseLong(osmValue.substring(1));
      return this.get(id);
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  public static QrankDb empty() {
    LongLongHashMap db = new LongLongHashMap();
    return new QrankDb(db);
  }

  public static QrankDb fromCsv(Path csvPath) throws IOException {
    GZIPInputStream gzip = new GZIPInputStream(new FileInputStream(csvPath.toFile()));
    try (BufferedReader br = new BufferedReader(new InputStreamReader(gzip))) {
      String content;
      LongLongHashMap db = new LongLongHashMap();
      String header = br.readLine(); // header
      assert (header.equals("Entity,QRank"));
      while ((content = br.readLine()) != null) {
        var split = content.split(",");
        long id = Long.parseLong(split[0].substring(1));
        long rank = Long.parseLong(split[1]);
        db.put(id, rank);
      }
      return new QrankDb(db);
    }
  }
}
