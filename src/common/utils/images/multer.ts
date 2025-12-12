import multer from "multer";
import DatauriParser from "datauri/parser.js";
import path from "path";

const storage = multer.memoryStorage();

// ✅ Multer upload with 5MB file size limit
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, or WEBP files are allowed"));
    }
    cb(null, true);
  },
});

const parser = new DatauriParser();

interface MulterFile {
  originalname: string;
  buffer: Buffer;
}

// ✅ Convert buffer to Base64 Data URI for Cloudinary upload
export const formatImage = (file: MulterFile): string => {
  const fileExtension = path.extname(file.originalname).toString();
  return parser.format(fileExtension, file.buffer)?.content as string;
};

export default upload;

// import multer from "multer";
// import DatauriParser from "datauri/parser.js";
// import path from "path";

// const storage = multer.memoryStorage();
// const upload = multer({ storage });

// const parser = new DatauriParser();

// interface MulterFile {
//   originalname: string;
//   buffer: Buffer;
// }

// export const formatImage = (file: MulterFile): string => {
//   const fileExtension = path.extname(file.originalname);
//   return parser.format(fileExtension, file.buffer)?.content as string;
// };

// export default upload;
